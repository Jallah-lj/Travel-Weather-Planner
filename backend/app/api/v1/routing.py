import time
from datetime import datetime, timezone, timedelta
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.auth import current_user
from app.core.cache import cache
from app.core.config import get_settings
from app.core.database import get_db
from app.core.responses import success
from app.models.entities import User
from app.schemas.routing import PlaceSearch, PlaceDetails, RouteRequest
from app.api.v1.trips import resolve_trip, get_plan
from app.services.journey import saved_stops
from app.services.google_maps import GoogleMapsProvider
from app.services.schedule import check_schedule

router=APIRouter(tags=['activity-routing'])

async def quota(user,kind):
    s=get_settings()
    if s.environment=='production' and cache.redis is None:raise HTTPException(503,'Shared routing quota enforcement requires Redis in production.')
    limits=[(f'google:{kind}:user:{user.id}:minute',getattr(s,f'google_{kind}_per_user_minute'),60),(f'google:{kind}:user:{user.id}:day',getattr(s,f'google_{kind}_per_user_day'),86400),(f'google:{kind}:global:day',getattr(s,f'google_{kind}_per_day'),86400)]
    # Time bucket in key ensures fixed windows even with the development memory fallback.
    now=int(datetime.now(timezone.utc).timestamp())
    if cache.redis is None:
        for old_key,(expires,_) in list(cache.memory.items()):
            if old_key.startswith('google:') and expires<time.time():cache.memory.pop(old_key,None)
    for key,limit,window in limits:
        allowed,_=await cache.allow(f'{key}:{now//window}',limit,window)
        if not allowed:raise HTTPException(429,'The app’s Google Maps request limit was reached. Try again later. Your trip is unchanged.')

def configured():
    s=get_settings()
    if s.environment=='production' and not s.google_maps_legal_approved:raise HTTPException(503,'Publish reviewed Terms and Privacy disclosures and approve Google Maps legal setup before production use.')
    if not s.google_maps_server_key:raise HTTPException(503,'Google Maps Platform needs a separate server API key. Gemini credentials are not used for routing.')

@router.get('/routing/config')
def routing_config(user:User=Depends(current_user)):
    s=get_settings()
    ready=bool(s.google_maps_server_key) and (s.environment!='production' or (s.google_maps_legal_approved and cache.redis is not None))
    return success({'provider':'Google Maps Platform','places_available':ready,'routing_available':ready,'browser_key':s.google_maps_browser_key,'map_available':bool(s.google_maps_browser_key),'max_activities':10,'limits':{'routes_per_minute':s.google_routes_per_user_minute,'routes_per_day':s.google_routes_per_user_day,'places_per_minute':s.google_places_per_user_minute,'places_per_day':s.google_places_per_user_day},'note':'These are app request limits, not Google billing entitlements. Enable Places API (New), Routes API, and Maps JavaScript API with restricted keys and billing.'})

@router.post('/trips/{trip_id}/places/search')
async def search_places(trip_id:str,payload:PlaceSearch,db:Session=Depends(get_db),user:User=Depends(current_user)):
    trip=resolve_trip(trip_id,db,user);configured()
    stop=next((stop for stop in saved_stops(trip,db) if stop.arrival_date<=payload.day_date<=stop.departure_date),None)
    if not stop:raise HTTPException(422,'Choose a day within this trip.')
    await quota(user,'places')
    return success(await GoogleMapsProvider().search(payload.query,payload.session_token,stop.destination.latitude,stop.destination.longitude))

@router.post('/trips/{trip_id}/places/details')
async def place_details(trip_id:str,payload:PlaceDetails,db:Session=Depends(get_db),user:User=Depends(current_user)):
    resolve_trip(trip_id,db,user);configured();await quota(user,'places')
    return success(await GoogleMapsProvider().details(payload.place_id,payload.session_token))

def saved_day(trip_id,payload,db,user):
    trip=resolve_trip(trip_id,db,user);plan=get_plan(trip,db)
    if plan.revision!=payload.revision:raise HTTPException(409,'This trip has changed. Reload the saved plan before checking directions.')
    day=next((day for day in plan.itinerary if day['date']==payload.day_date.isoformat()),None)
    if not day:raise HTTPException(404,'Itinerary day not found')
    return day


def checked_schedule(trip_id, day, db, legs=None, buffer=10):
    result=check_schedule(day['items'],legs,buffer)
    from app.models.entities import Trip
    import uuid
    trip=db.get(Trip,uuid.UUID(trip_id))
    if not trip:raise HTTPException(404,'Trip no longer exists')
    when=datetime.fromisoformat(day['date'])
    stop=next((stop for stop in saved_stops(trip,db) if stop.arrival_date<=when.date()<=stop.departure_date),None)
    try:
        zone=ZoneInfo(stop.destination.timezone) if stop else None
        transition=zone is None or when.replace(tzinfo=zone).utcoffset()!=(when+timedelta(days=1)).replace(tzinfo=zone).utcoffset()
    except ZoneInfoNotFoundError: transition=True
    if transition:
        result['issues'].append({'code':'timezone_review','message':'The timezone is unavailable or changes on this date. Review local times manually; wall-clock checks cannot confirm this schedule.'})
        if result['status']=='no_conflicts_detected':result['status']='incomplete'
    return result

@router.post('/trips/{trip_id}/schedule')
def schedule(trip_id:str,payload:RouteRequest,db:Session=Depends(get_db),user:User=Depends(current_user)):
    day=saved_day(trip_id,payload,db,user)
    return success(checked_schedule(trip_id,day,db,buffer=payload.buffer_minutes))

@router.post('/trips/{trip_id}/route')
async def route_day(trip_id:str,payload:RouteRequest,db:Session=Depends(get_db),user:User=Depends(current_user)):
    day=saved_day(trip_id,payload,db,user);configured();items=day['items']
    if not 2<=len(items)<=10:raise HTTPException(422,'Routes support 2–10 activities per day in this app.')
    if any(not item.get('location') or item['location'].get('provider')!='google' for item in items):raise HTTPException(422,'Link every activity to a Google place before calculating a route. Missing locations are not skipped.')
    await quota(user,'routes')
    result=await GoogleMapsProvider().route(items,day.get('travel_mode','DRIVE'))
    return success({**result,'provider':'Google Maps','mode':day.get('travel_mode','DRIVE'),'activity_ids':[item['id'] for item in items],'generated_at':datetime.now(timezone.utc).isoformat(),'schedule':checked_schedule(trip_id,day,db,result['legs'],payload.buffer_minutes),'notice':'Driving uses traffic-unaware estimates. Walking/cycling directions may omit sidewalks or cycleways; use caution. No flights, trains, opening-hours or safety checks are included.'})
