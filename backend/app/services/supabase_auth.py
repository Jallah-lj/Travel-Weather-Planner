"""Trust Supabase's authenticated /user response, never client-decoded JWT claims."""
import uuid
import httpx
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from app.core.config import get_settings
from app.models.entities import User, Profile


def verified_identity(token: str) -> dict:
    settings = get_settings()
    try:
        with httpx.Client(timeout=8) as client:
            response = client.get(settings.supabase_url.rstrip('/') + '/auth/v1/user',
                headers={'apikey': settings.supabase_publishable_key, 'Authorization': f'Bearer {token}'})
        if response.status_code in (401, 403):
            raise HTTPException(401, 'Invalid or expired session. Please log in again.')
        if response.status_code != 200:
            raise HTTPException(503, 'Authentication service unavailable. Please retry.')
        data = response.json()
        if not isinstance(data,dict) or not isinstance(data.get('id'),str):raise ValueError('Invalid identity')
        uuid.UUID(data['id'])
        if not data.get('email') or not data.get('email_confirmed_at') or data.get('is_anonymous'):
            raise HTTPException(403, 'Confirm your email before continuing.')
        if not isinstance(data['email'],str) or len(data['email'])>320:raise ValueError('Invalid identity email')
        return data
    except (httpx.HTTPError, ValueError, KeyError, TypeError) as exc:
        raise HTTPException(503, 'Authentication service unavailable. Please retry.') from exc


def resolve_user(token: str, db: Session) -> User:
    identity = verified_identity(token)
    subject = uuid.UUID(identity['id'])
    user = db.scalar(select(User).where(User.supabase_subject == subject))
    if user:
        if not user.is_active: raise HTTPException(403, 'Account disabled')
        return user
    # Never claim an old account merely by matching an email address.
    email = identity['email'].lower()
    if db.scalar(select(User).where(User.email == email)):
        raise HTTPException(409, 'This account needs a secure migration. Contact the site administrator.')
    user = User(id=subject, supabase_subject=subject, email=email, password_hash='!supabase-managed')
    metadata=identity.get('user_metadata')
    name = str((metadata if isinstance(metadata,dict) else {}).get('display_name') or 'Traveler')[:120]
    try:
        db.add(user); db.flush(); db.add(Profile(user_id=user.id, display_name=name)); db.commit()
    except IntegrityError:
        db.rollback()
        user = db.scalar(select(User).where(User.supabase_subject == subject))
        if not user: raise HTTPException(409, 'Account provisioning conflict. Contact support.')
    if not user.is_active: raise HTTPException(403, 'Account disabled')
    return user
