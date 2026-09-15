import uuid
from datetime import date
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.models.entities import Destination, Trip, TripDestination

DESTINATIONS = [
    ("kigali-rwanda", "Kigali", "Rwanda", "RW", "🇷🇼", "Africa/Kigali", -1.9441, 30.0619),
    ("paris-france", "Paris", "France", "FR", "🇫🇷", "Europe/Paris", 48.8566, 2.3522),
    ("cape-town-south-africa", "Cape Town", "South Africa", "ZA", "🇿🇦", "Africa/Johannesburg", -33.9249, 18.4241),
    ("rome-italy", "Rome", "Italy", "IT", "🇮🇹", "Europe/Rome", 41.9028, 12.4964),
    ("tokyo-japan", "Tokyo", "Japan", "JP", "🇯🇵", "Asia/Tokyo", 35.6762, 139.6503),
    ("barcelona-spain", "Barcelona", "Spain", "ES", "🇪🇸", "Europe/Madrid", 41.3874, 2.1686),
    ("nairobi-kenya", "Nairobi", "Kenya", "KE", "🇰🇪", "Africa/Nairobi", -1.2921, 36.8219),
    ("dubai-uae", "Dubai", "United Arab Emirates", "AE", "🇦🇪", "Asia/Dubai", 25.2048, 55.2708),
]
DEMO_TRIP_ID = uuid.UUID("11111111-1111-4111-8111-111111111111")

def seed_database(db: Session, include_demo: bool = True) -> None:
    if not db.scalar(select(Destination.id).limit(1)):
        for slug, name, country, code, flag, timezone, latitude, longitude in DESTINATIONS:
            db.add(Destination(slug=slug, name=name, country=country, country_code=code, flag=flag, timezone=timezone, latitude=latitude, longitude=longitude))
        db.commit()
    if include_demo and not db.get(Trip, DEMO_TRIP_ID):
        kigali = db.scalar(select(Destination).where(Destination.slug == "kigali-rwanda"))
        trip = Trip(id=DEMO_TRIP_ID, title="Kigali weekend", departure_date=date(2026, 8, 28), return_date=date(2026, 8, 30), travel_style="relaxed", activities=["sightseeing", "walking", "food", "nature"])
        db.add(trip); db.flush()
        db.add(TripDestination(trip_id=trip.id, destination_id=kigali.id, arrival_date=trip.departure_date, departure_date=trip.return_date, position=0))
        db.commit()
