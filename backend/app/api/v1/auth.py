import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.responses import success
from app.core.security import create_token_pair, decode_token, hash_password, verify_password
from app.models.entities import Profile, User
from app.schemas.auth import LoginRequest, RefreshRequest, RegisterRequest

def local_auth_only():
    from app.core.config import get_settings
    if get_settings().auth_provider != "local":
        raise HTTPException(410, "Use Supabase Auth to manage your account")

router = APIRouter(prefix="/auth", tags=["authentication"], dependencies=[Depends(local_auth_only)])

@router.post("/register", status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, db: Session = Depends(get_db)):
    email = payload.email.lower()
    if db.scalar(select(User).where(User.email == email)): raise HTTPException(status_code=409, detail="An account already exists for this email")
    user = User(email=email, password_hash=hash_password(payload.password)); db.add(user); db.flush(); db.add(Profile(user_id=user.id, display_name=payload.display_name)); db.commit()
    return success({"user": {"id": str(user.id), "email": user.email, "display_name": payload.display_name}, **create_token_pair(str(user.id))})

@router.post("/login")
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == payload.email.lower()))
    if not user or not verify_password(payload.password, user.password_hash): raise HTTPException(status_code=401, detail="Invalid email or password")
    if not user.is_active: raise HTTPException(status_code=403, detail="Account disabled")
    return success({"user": {"id": str(user.id), "email": user.email}, **create_token_pair(str(user.id))})

@router.post("/refresh")
def refresh(payload: RefreshRequest, db: Session = Depends(get_db)):
    decoded = decode_token(payload.refresh_token, "refresh")
    try: user_id = uuid.UUID(decoded["sub"])
    except (ValueError, KeyError) as exc: raise HTTPException(status_code=401, detail="Invalid refresh token") from exc
    user = db.get(User, user_id)
    if not user or not user.is_active: raise HTTPException(status_code=401, detail="User unavailable")
    return success(create_token_pair(str(user.id)))
