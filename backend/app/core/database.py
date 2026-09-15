from collections.abc import Generator
from sqlalchemy import create_engine
from sqlalchemy.pool import NullPool
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker
from app.core.config import get_settings

settings = get_settings()
connect_args = {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}
if settings.database_url.startswith("postgresql+psycopg"):
    connect_args = {"prepare_threshold": None, "connect_timeout": 10}
engine = create_engine(settings.database_url, pool_pre_ping=True, connect_args=connect_args,
                       **({"poolclass": NullPool} if settings.database_null_pool or settings.environment == "production" else {}))
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)

class Base(DeclarativeBase):
    pass

def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
