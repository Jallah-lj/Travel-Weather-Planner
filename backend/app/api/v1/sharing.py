import hashlib
import re
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Literal
from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.core.auth import current_user
from app.core.database import get_db
from app.core.responses import success
from app.models.entities import Trip, TripShare, User
from app.api.v1.trips import resolve_trip, plan_payload, persist_plan
from app.schemas.plan import PlanUpdate

router = APIRouter(tags=['trip-sharing'])
def utc(value): return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value

def public_metadata(share):
    return {'id': str(share.id), 'permission': share.permission, 'expires_at': utc(share.expires_at).isoformat(), 'created_at': utc(share.created_at).isoformat(), 'revoked': share.revoked_at is not None}

class ShareCreate(BaseModel):
    permission: Literal['view', 'edit'] = 'view'
    expires_in_days: int = Field(default=7, ge=1, le=30)

@router.post('/trips/{trip_id}/shares', status_code=201)
def create_share(trip_id: str, payload: ShareCreate, db: Session = Depends(get_db), user: User = Depends(current_user)):
    trip = resolve_trip(trip_id, db, user)
    now = datetime.now(timezone.utc)
    existing = db.scalars(select(TripShare).where(TripShare.trip_id == trip.id, TripShare.revoked_at.is_(None), TripShare.expires_at > now)).all()
    if len(existing) >= 10: raise HTTPException(409, 'Revoke an active link before creating another (maximum 10).')
    token = secrets.token_urlsafe(32)
    share = TripShare(trip_id=trip.id, token_hash=hashlib.sha256(token.encode()).hexdigest(), permission=payload.permission, expires_at=now + timedelta(days=payload.expires_in_days))
    db.add(share); db.commit(); db.refresh(share)
    return success({**public_metadata(share), 'token': token})  # returned only once

@router.get('/trips/{trip_id}/shares')
def list_shares(trip_id: str, db: Session = Depends(get_db), user: User = Depends(current_user)):
    trip = resolve_trip(trip_id, db, user)
    return success([public_metadata(item) for item in db.scalars(select(TripShare).where(TripShare.trip_id == trip.id).order_by(TripShare.created_at.desc())).all()])

@router.delete('/trips/{trip_id}/shares/{share_id}')
def revoke_share(trip_id: str, share_id: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(current_user)):
    trip = resolve_trip(trip_id, db, user)
    share = db.scalar(select(TripShare).where(TripShare.id == share_id, TripShare.trip_id == trip.id).with_for_update())
    if not share: raise HTTPException(404, 'Link not found')
    share.revoked_at = datetime.now(timezone.utc); db.commit()
    return success({'revoked': True})

def resolve_share(token: str, db: Session, edit=False):
    if not re.fullmatch(r'[A-Za-z0-9_-]{43}', token): raise HTTPException(404, 'This link is invalid, expired, or revoked.')
    query = select(TripShare).where(TripShare.token_hash == hashlib.sha256(token.encode()).hexdigest())
    if edit: query = query.with_for_update()
    share = db.scalar(query)
    if not share or share.revoked_at or utc(share.expires_at) <= datetime.now(timezone.utc): raise HTTPException(404, 'This link is invalid, expired, or revoked.')
    trip = db.get(Trip, share.trip_id)
    if not trip: raise HTTPException(404, 'This link is invalid, expired, or revoked.')
    owner = db.get(User, trip.user_id) if trip.user_id else None
    if not owner or not owner.is_active: raise HTTPException(404, 'This link is unavailable.')
    if edit and share.permission != 'edit': raise HTTPException(403, 'This link is view-only. Changes were not saved.')
    return share, trip

@router.get('/shared/plan')
def shared_plan(share_token: str = Header(default='', alias='X-Trip-Share'), db: Session = Depends(get_db)):
    share, trip = resolve_share(share_token, db)
    return success({'plan': plan_payload(trip, db), 'permission': share.permission, 'expires_at': utc(share.expires_at).isoformat()})

@router.put('/shared/plan')
async def shared_save(payload: PlanUpdate, share_token: str = Header(default='', alias='X-Trip-Share'), db: Session = Depends(get_db)):
    share, trip = resolve_share(share_token, db, edit=True)
    return await persist_plan(trip, payload, db)
