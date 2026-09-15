from datetime import date
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import joinedload
from app.models.entities import Destination, TripDestination
from app.schemas.destination import DestinationOut
from app.schemas.journey import TripStopInput


def requested_stops(payload, db):
    specs = payload.stops or [TripStopInput(destination_id=payload.destination_id, arrival_date=payload.departure_date, departure_date=payload.return_date)]
    return resolve_destinations(specs, db)

def resolve_destinations(specs, db):
    resolved = []
    for index, spec in enumerate(specs):
        destination = db.get(Destination, spec.destination_id)
        if not destination: raise HTTPException(404, f'Destination for stop {index+1} was not found')
        resolved.append((spec, destination))
    return resolved

def saved_stops(trip, db):
    return list(db.scalars(select(TripDestination).options(joinedload(TripDestination.destination)).where(TripDestination.trip_id == trip.id).order_by(TripDestination.position)).all())

def serialize_stops(trip, db):
    return [{'id':str(stop.id), 'position':stop.position, 'arrival_date':stop.arrival_date.isoformat(), 'departure_date':stop.departure_date.isoformat(), 'destination':DestinationOut.model_validate(stop.destination).model_dump(mode='json')} for stop in saved_stops(trip, db)]

def day_destination(plan, day):
    for stop in plan.get('stops', []):
        if stop['arrival_date'] <= day <= stop['departure_date']: return stop['destination']
    return plan['destination']  # compatibility with pre-multi-stop export snapshots
