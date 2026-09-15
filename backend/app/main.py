from contextlib import asynccontextmanager
import logging
import time
import uuid
from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import structlog
from app.api.v1.router import api_router
from app.core.cache import cache
from app.core.config import get_settings
from app.core.database import Base, SessionLocal, engine
from app.core.responses import error, success
from app.core.seed import seed_database
import app.models  # noqa: F401

settings = get_settings()
logging.basicConfig(level=settings.log_level, format="%(message)s")
logger = structlog.get_logger()

@asynccontextmanager
async def lifespan(_: FastAPI):
    settings.validate_production()
    if settings.environment != "production":
        Base.metadata.create_all(bind=engine)
        with SessionLocal() as db: seed_database(db)
    await cache.connect()
    logger.info("application_started", environment=settings.environment, provider=settings.weather_provider)
    yield
    await cache.close()

app = FastAPI(title=settings.app_name, version="1.0.0", docs_url="/docs" if settings.environment != "production" else None, lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origins, allow_credentials=True, allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"], allow_headers=["Authorization", "Content-Type", "X-Request-ID", "X-Trip-Share", "X-App-Token"])

@app.middleware("http")
async def request_context(request: Request, call_next):
    request_id = request.headers.get("X-Request-ID", str(uuid.uuid4())); started = time.perf_counter()
    client = request.client.host if request.client else "unknown"
    sensitive = request.url.path.startswith("/api/v1/auth") or request.url.path.startswith("/api/v1/ai/") or request.url.path.startswith("/api/v1/shared")
    limit = 30 if sensitive else 240
    # Vercel overwrites this header; do not trust arbitrary X-Forwarded-For.
    import os
    if os.environ.get("VERCEL") == "1":
        client = request.headers.get("x-vercel-forwarded-for", client).split(",")[0].strip()
    try:
        allowed, remaining = await cache.allow(f"rate:{client}:{request.url.path if sensitive else 'general'}", limit, 60)
    except Exception:
        return JSONResponse(status_code=503, content=error("SERVICE_UNAVAILABLE", "Service temporarily unavailable. Please retry."), headers={"Cache-Control":"no-store", "Retry-After":"30"})
    if not allowed:
        response = JSONResponse(status_code=429, content=error("RATE_LIMITED", "Too many requests. Please try again shortly."))
        response.headers["Retry-After"] = "60"
    else:
        try: response = await call_next(request)
        except Exception:
            logger.exception("unhandled_request_error", request_id=request_id, endpoint=request.url.path)
            raise
        response.headers["X-RateLimit-Remaining"] = str(remaining)
    if request.url.path.startswith(("/api/v1/trips", "/api/v1/ai", "/api/v1/auth", "/api/v1/shared", "/api/v1/routing")):
        response.headers["Cache-Control"] = "no-store"
    response.headers["X-Request-ID"] = request_id
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "no-referrer"
    if request.url.path.startswith("/api/v1/shared"):
        response.headers["X-Robots-Tag"] = "noindex, nofollow, noarchive"
    response.headers["Permissions-Policy"] = "geolocation=(), camera=(), microphone=()"
    if settings.environment == "production": response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    logger.info("request_completed", request_id=request_id, endpoint=request.url.path, method=request.method, status_code=response.status_code, response_time_ms=round((time.perf_counter() - started) * 1000, 2))
    return response

@app.exception_handler(HTTPException)
async def http_exception_handler(_: Request, exc: HTTPException):
    code = "NOT_FOUND" if exc.status_code == 404 else "REQUEST_ERROR"
    return JSONResponse(status_code=exc.status_code, content=error(code, str(exc.detail)))

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(_: Request, exc: RequestValidationError):
    fields = [{"field": ".".join(str(v) for v in item["loc"]), "message": item["msg"]} for item in exc.errors()]
    return JSONResponse(status_code=422, content={**error("VALIDATION_ERROR", "Please check the submitted information."), "fields": fields})

@app.get("/health", tags=["system"])
def health():
    return success({"status": "healthy", "environment": settings.environment, "weather_provider": settings.weather_provider})

@app.get("/ready", tags=["system"])
async def ready():
    from sqlalchemy import text
    from starlette.concurrency import run_in_threadpool
    def check_database():
        with SessionLocal() as db:
            return db.execute(text("SELECT version_num FROM alembic_version")).scalar_one()
    try:
        revision = await run_in_threadpool(check_database)
        if revision != "20260915_supabase": raise RuntimeError("Migration required")
        if not cache.redis or not await cache.redis.ping(): raise RuntimeError("Redis unavailable")
    except Exception:
        return JSONResponse(status_code=503, content=error("NOT_READY", "Dependencies or migrations are not ready"), headers={"Cache-Control":"no-store"})
    return JSONResponse(content=success({"status":"ready"}), headers={"Cache-Control":"no-store"})

app.include_router(api_router, prefix="/api/v1")
