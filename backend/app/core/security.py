from datetime import datetime, timedelta, timezone
import uuid
import jwt
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError, InvalidHashError, VerificationError
from fastapi import HTTPException, status
from app.core.config import get_settings

_hasher = PasswordHasher(time_cost=3, memory_cost=65536, parallelism=2)
settings = get_settings()

def hash_password(password: str) -> str:
    return _hasher.hash(password)

def verify_password(password: str, password_hash: str) -> bool:
    try: return _hasher.verify(password_hash, password)
    except (VerifyMismatchError, InvalidHashError, VerificationError): return False

def create_token(subject: str, token_type: str, expires_delta: timedelta) -> str:
    now = datetime.now(timezone.utc)
    return jwt.encode({"sub": subject, "type": token_type, "iat": now, "exp": now + expires_delta, "jti": str(uuid.uuid4())}, settings.secret_key, algorithm="HS256")

def create_token_pair(user_id: str) -> dict[str, object]:
    return {"access_token": create_token(user_id, "access", timedelta(minutes=settings.access_token_minutes)), "refresh_token": create_token(user_id, "refresh", timedelta(days=settings.refresh_token_days)), "token_type": "bearer", "expires_in": settings.access_token_minutes * 60}

def decode_token(token: str, expected_type: str) -> dict:
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=["HS256"])
        if payload.get("type") != expected_type: raise ValueError("Wrong token type")
        return payload
    except (jwt.InvalidTokenError, ValueError) as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token") from exc
