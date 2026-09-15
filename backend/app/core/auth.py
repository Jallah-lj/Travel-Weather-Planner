import uuid
from fastapi import Depends, HTTPException, Header
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import decode_token
from app.models.entities import User

bearer = HTTPBearer(auto_error=False)
def current_user(credentials: HTTPAuthorizationCredentials | None = Depends(bearer), db: Session = Depends(get_db), app_token: str | None = Header(default=None, alias='X-App-Token')) -> User:
    token = app_token or (credentials.credentials if credentials else None)
    if not token: raise HTTPException(401, 'Please log in to continue')
    from app.core.config import get_settings
    if get_settings().auth_provider == 'supabase':
        from app.services.supabase_auth import resolve_user
        return resolve_user(token, db)
    payload = decode_token(token, 'access')
    try: user = db.get(User, uuid.UUID(payload['sub']))
    except (ValueError, KeyError): raise HTTPException(401, 'Invalid session')
    if not user or not user.is_active: raise HTTPException(401, 'Account unavailable')
    return user
