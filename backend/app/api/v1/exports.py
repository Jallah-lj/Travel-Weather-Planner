from typing import Literal
from fastapi import APIRouter, Depends
from fastapi.responses import Response
from sqlalchemy.orm import Session
from app.core.auth import current_user
from app.core.database import get_db
from app.models.entities import User
from app.api.v1.trips import resolve_trip, plan_payload
from app.services.exports import calendar, pdf, offline_html

router = APIRouter(tags=['trip-exports'])

@router.get('/trips/{trip_id}/export/{kind}')
def export_trip(trip_id: str, kind: Literal['calendar', 'pdf', 'offline'], db: Session = Depends(get_db), user: User = Depends(current_user)):
    trip = resolve_trip(trip_id, db, user)
    plan = plan_payload(trip, db)
    generator, mime, extension = {'calendar':(calendar,'text/calendar; charset=utf-8','ics'), 'pdf':(pdf,'application/pdf','pdf'), 'offline':(offline_html,'text/html; charset=utf-8','html')}[kind]
    payload = generator(plan)
    return Response(payload, media_type=mime, headers={'Content-Disposition': f'attachment; filename="trip-{trip.id}-r{plan["revision"]}.{extension}"', 'Cache-Control':'no-store'})
