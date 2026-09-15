from types import SimpleNamespace
from app.schemas.journey import StopsUpdate
from app.services.journey import requested_stops, saved_stops, serialize_stops, resolve_destinations
from sqlalchemy.exc import IntegrityError
from datetime import timedelta
from sqlalchemy import update, delete
from app.core.auth import current_user
from app.models.entities import User, TripPlan, TripShare
from app.schemas.plan import PlanUpdate
import uuid
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.core.cache import cache
from app.core.database import get_db
from app.core.responses import success
from app.core.seed import DEMO_TRIP_ID
from app.models.entities import Destination, Trip, TripDestination
from app.providers.factory import create_weather_provider
from app.schemas.trip import TripCreate, TripUpdate
from app.services.intelligence import TravelIntelligenceService

router = APIRouter(prefix="/trips", tags=["trips"])
intelligence = TravelIntelligenceService(create_weather_provider())

def resolve_trip(raw_id: str, db: Session, user: User) -> Trip:
    if raw_id == "demo": trip_id = DEMO_TRIP_ID
    else:
        try: trip_id = uuid.UUID(raw_id)
        except ValueError as exc: raise HTTPException(status_code=404, detail="Trip not found") from exc
    trip = db.get(Trip, trip_id)
    if not trip or trip.user_id != user.id: raise HTTPException(status_code=404, detail="Trip not found")
    return trip

def trip_destination(trip: Trip, db: Session) -> Destination:
    destination = db.scalar(select(Destination).join(TripDestination).where(TripDestination.trip_id == trip.id).order_by(TripDestination.position))
    if not destination: raise HTTPException(status_code=422, detail="Trip has no destination")
    return destination

async def get_analysis(raw_id: str, db: Session, user: User, stop_id: uuid.UUID | None = None) -> dict:
    trip = resolve_trip(raw_id, db, user)
    stops = saved_stops(trip, db)
    stop = next((item for item in stops if item.id == stop_id), None) if stop_id else (stops[0] if stops else None)
    if stop is None: raise HTTPException(404, 'Trip stop not found')
    key = f"trip:analysis:stop:{trip.id}:{stop.id}:{stop.arrival_date}:{stop.departure_date}:{intelligence.provider.name}"
    cached = await cache.get(key)
    if cached: return cached
    scoped_trip = SimpleNamespace(id=trip.id, departure_date=stop.arrival_date, return_date=stop.departure_date, activities=trip.activities, travel_style=trip.travel_style)
    analysis = await intelligence.analyze_trip(scoped_trip, stop.destination)
    analysis['meta'].update(scope='selected stop only', stop_id=str(stop.id), stop_count=len(stops))
    await cache.set(key, analysis, 900)
    return analysis

@router.post("", status_code=status.HTTP_201_CREATED)
async def create_trip(payload: TripCreate, request: Request, db: Session = Depends(get_db), user: User = Depends(current_user)):
    resolved = requested_stops(payload, db)
    destination = resolved[0][1]
    trip_id = uuid.uuid5(user.id, str(payload.request_id)) if payload.request_id else uuid.uuid4()
    existing = db.get(Trip, trip_id)
    if existing:
        if existing.user_id != user.id: raise HTTPException(404, 'Trip not found')
        return success({"id": str(existing.id), "title": existing.title, "status": existing.status})
    trip = Trip(id=trip_id, user_id=user.id, title=payload.title or (" → ".join(place.name for _,place in resolved)[:175] if len(resolved)>1 else f"{destination.name} trip"), departure_date=payload.departure_date, return_date=payload.return_date, travel_style=payload.travel_style, activities=payload.activities)
    try:
        db.add(trip); db.flush()
        for position, (spec, place) in enumerate(resolved):
            db.add(TripDestination(trip_id=trip.id, destination_id=place.id, arrival_date=spec.arrival_date, departure_date=spec.departure_date, position=position))
        if payload.initial_plan is not None:
            draft = payload.initial_plan.model_dump(mode='json')
            db.add(TripPlan(trip_id=trip.id, itinerary=draft['itinerary'], packing=draft['packing'], revision=1))
        else:
            # Materialize an empty itinerary and essentials in the same transaction.
            db.add(TripPlan(trip_id=trip.id, itinerary=[{"date": (trip.departure_date+timedelta(days=i)).isoformat(), "label": (trip.departure_date+timedelta(days=i)).strftime('%A'), "headline": "Your itinerary", "items": []} for i in range((trip.return_date-trip.departure_date).days+1)], packing=[{"id": str(uuid.uuid4()), "name": name, "category": "Travel essentials", "quantity": 1, "packed": False} for name in ['Travel documents', 'Phone charger', 'Personal medication']], revision=1))
        db.commit(); db.refresh(trip)
    except IntegrityError:
        db.rollback()
        existing = db.get(Trip, trip_id)
        if payload.request_id and existing and existing.user_id == user.id:
            return success({"id": str(existing.id), "title": existing.title, "status": existing.status})
        raise

    return success({"id": str(trip.id), "title": trip.title, "status": trip.status})

@router.get("")
def list_trips(db: Session = Depends(get_db), user: User = Depends(current_user)):
    trips = db.scalars(select(Trip).where(Trip.user_id == user.id).order_by(Trip.departure_date)).all()
    data = []
    for trip in trips:
        destination = trip_destination(trip, db)
        data.append({
            "id": str(trip.id), "title": trip.title, "departure_date": trip.departure_date,
            "return_date": trip.return_date, "travel_style": trip.travel_style, "status": trip.status, "stops": serialize_stops(trip, db),
            "destination": {
                "id": str(destination.id), "name": destination.name, "country": destination.country,
                "country_code": destination.country_code, "flag": destination.flag, "timezone": destination.timezone,
                "latitude": destination.latitude, "longitude": destination.longitude,
            },
        })
    return success(data)

@router.get("/{trip_id}")
def retrieve_trip(trip_id: str, db: Session = Depends(get_db), user: User = Depends(current_user)):
    trip = resolve_trip(trip_id, db, user); destination = trip_destination(trip, db)
    return success({"id": str(trip.id), "title": trip.title, "departure_date": trip.departure_date, "return_date": trip.return_date, "travel_style": trip.travel_style, "activities": trip.activities, "status": trip.status, "destination_id": str(destination.id), "stops": serialize_stops(trip, db)})

@router.put("/{trip_id}")
async def update_trip(trip_id: str, payload: TripUpdate, db: Session = Depends(get_db), user: User = Depends(current_user)):
    trip = resolve_trip(trip_id, db, user)
    if (payload.departure_date and payload.departure_date != trip.departure_date) or (payload.return_date and payload.return_date != trip.return_date):
        raise HTTPException(409, 'Change dates using Manage stops so the itinerary and stop schedule stay consistent.')
    for key, value in payload.model_dump(exclude_none=True).items(): setattr(trip, key, value)
    if (trip.return_date-trip.departure_date).days > 60: raise HTTPException(422, "Trips cannot exceed 60 days")
    if trip.return_date < trip.departure_date: raise HTTPException(status_code=422, detail="Return date must follow departure date")
    db.commit(); await cache.delete(f"trip:analysis:{trip.id}")
    return success({"id": str(trip.id), "updated": True})

@router.delete("/{trip_id}", status_code=status.HTTP_200_OK)
async def delete_trip(trip_id: str, db: Session = Depends(get_db), user: User = Depends(current_user)):
    trip = resolve_trip(trip_id, db, user)
    if trip.id == DEMO_TRIP_ID: raise HTTPException(status_code=403, detail="The shared demo trip cannot be deleted")
    plan = db.get(TripPlan, trip.id)
    if plan: db.delete(plan)
    db.execute(delete(TripShare).where(TripShare.trip_id == trip.id))
    db.delete(trip); db.commit(); await cache.delete(f"trip:analysis:{trip.id}")
    return success({"deleted": True})

@router.get("/{trip_id}/analysis")
async def trip_analysis(trip_id: str, db: Session = Depends(get_db), user: User = Depends(current_user), stop_id: uuid.UUID | None = None):
    data = await get_analysis(trip_id, db, user, stop_id)
    trip = resolve_trip(trip_id, db, user)
    plan = get_plan(trip, db)
    data = {**data, "itinerary": plan.itinerary, "packing": plan.packing}
    return success(data, {"provider": intelligence.provider.name, "cached_for_seconds": 900})

@router.get("/{trip_id}/weather")
async def trip_weather(trip_id: str, db: Session = Depends(get_db), user: User = Depends(current_user), stop_id: uuid.UUID | None = None):
    data = await get_analysis(trip_id, db, user, stop_id); return success({"current": data["current"], "forecast": data["forecast"], "hourly": data["hourly"], "risks": data["risks"]}, data["meta"])

@router.get("/{trip_id}/activities")
async def trip_activities(trip_id: str, db: Session = Depends(get_db), user: User = Depends(current_user)):
    return success((await get_analysis(trip_id, db, user))["activities"])

@router.get("/{trip_id}/packing")
async def trip_packing(trip_id: str, db: Session = Depends(get_db), user: User = Depends(current_user)):
    return success(get_plan(resolve_trip(trip_id, db, user), db).packing)

@router.post("/{trip_id}/optimize")
async def optimize_trip(trip_id: str, db: Session = Depends(get_db), user: User = Depends(current_user)):
    resolve_trip(trip_id, db, user)
    raise HTTPException(501, "Automatic optimization is not available. Your saved itinerary has not been changed.")


def get_plan(trip: Trip, db: Session) -> TripPlan:
    plan = db.get(TripPlan, trip.id)
    if plan is None:
        days = []
        for index in range((trip.return_date - trip.departure_date).days + 1):
            when = trip.departure_date + timedelta(days=index)
            days.append({"date": when.isoformat(), "label": when.strftime('%A'), "headline": "Your itinerary", "items": []})
        plan = TripPlan(trip_id=trip.id, itinerary=days, packing=[{"id": str(uuid.uuid4()), "name": name, "category": "Travel essentials", "quantity": 1, "packed": False} for name in ['Travel documents', 'Phone charger', 'Personal medication']], revision=1)
        db.add(plan); db.commit(); db.refresh(plan)
    return plan

@router.get('/{trip_id}/plan')
def read_plan(trip_id: str, db: Session = Depends(get_db), user: User = Depends(current_user)):
    trip = resolve_trip(trip_id, db, user)
    return success(plan_payload(trip, db))

def plan_payload(trip: Trip, db: Session):
    plan = get_plan(trip, db)
    destination = trip_destination(trip, db)
    from app.schemas.destination import DestinationOut
    return {"trip_id": str(trip.id), "title": trip.title, "departure_date": trip.departure_date.isoformat(), "return_date": trip.return_date.isoformat(), "destination": DestinationOut.model_validate(destination).model_dump(mode='json'), "itinerary": plan.itinerary, "packing": plan.packing, "revision": plan.revision, "stops": serialize_stops(trip, db)}

@router.put('/{trip_id}/plan')
async def save_plan(trip_id: str, payload: PlanUpdate, db: Session = Depends(get_db), user: User = Depends(current_user)):
    trip = resolve_trip(trip_id, db, user)
    return await persist_plan(trip, payload, db)

async def persist_plan(trip: Trip, payload: PlanUpdate, db: Session):
    for day in payload.itinerary:
        if not trip.departure_date <= day.date <= trip.return_date: raise HTTPException(422, 'Itinerary dates must be within the trip dates')
    if len({day.date for day in payload.itinerary}) != len(payload.itinerary): raise HTTPException(422, 'Duplicate itinerary dates')
    ids = [item.id for day in payload.itinerary for item in day.items]
    if len(ids) != len(set(ids)) or len({item.id for item in payload.packing}) != len(payload.packing): raise HTTPException(422, 'Item identifiers must be unique')
    values = payload.model_dump(mode='json')
    result = db.execute(update(TripPlan).where(TripPlan.trip_id == trip.id, TripPlan.revision == payload.revision).values(itinerary=values['itinerary'], packing=values['packing'], revision=payload.revision + 1))
    if result.rowcount != 1:
        db.rollback(); raise HTTPException(409, 'This plan changed in another tab. Reload the saved plan before saving again.')
    db.commit(); await cache.delete(f'trip:analysis:{trip.id}')
    return success({"revision": payload.revision + 1, "saved": True})


@router.put('/{trip_id}/stops')
async def update_stops(trip_id: str, payload: StopsUpdate, db: Session = Depends(get_db), user: User = Depends(current_user)):
    trip = resolve_trip(trip_id, db, user)
    resolved = resolve_destinations(payload.stops, db)
    plan = get_plan(trip, db)
    if plan.revision != payload.revision: raise HTTPException(409, 'The trip changed in another tab. Reload before changing stops.')
    start, end = payload.stops[0].arrival_date, payload.stops[-1].departure_date
    old_stops = saved_stops(trip, db)
    old_days = {day['date']:day for day in plan.itinerary}
    for key, day in old_days.items():
        if day['items'] and not start.isoformat() <= key <= end.isoformat(): raise HTTPException(422, 'These dates would remove days with activities. Move or remove those activities first.')
        if day['items'] and not payload.confirm_reassignment:
            previous = next((s.destination_id for s in old_stops if s.arrival_date.isoformat() <= key <= s.departure_date.isoformat()), None)
            incoming = next((s.destination_id for s in payload.stops if s.arrival_date.isoformat() <= key <= s.departure_date.isoformat()), None)
            if previous != incoming: raise HTTPException(422, 'Changing these stops reassigns existing activities to a different destination. Confirm that you will review their locations and local times.')
    days = []
    for index in range((end-start).days+1):
        when = start+timedelta(days=index); key = when.isoformat()
        days.append(old_days.get(key, {'date':key,'label':when.strftime('%A'),'headline':'Your itinerary','items':[]}))
    changed = db.execute(update(TripPlan).where(TripPlan.trip_id==trip.id, TripPlan.revision==payload.revision).values(itinerary=days,revision=payload.revision+1))
    if changed.rowcount != 1: db.rollback(); raise HTTPException(409, 'The trip changed. Reload before saving stops.')
    db.execute(delete(TripDestination).where(TripDestination.trip_id==trip.id))
    for position, (spec, place) in enumerate(resolved):
        db.add(TripDestination(trip_id=trip.id,destination_id=place.id,arrival_date=spec.arrival_date,departure_date=spec.departure_date,position=position))
    trip.departure_date = start; trip.return_date = end
    db.commit(); db.expire_all()
    return success(plan_payload(trip, db))
