import httpx
from sqlalchemy.exc import IntegrityError
from app.services.geocoding import search_places
import uuid
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_, select
from sqlalchemy.orm import Session
from app.core.cache import cache
from app.core.database import get_db
from app.core.responses import success
from app.models.entities import Destination
from app.schemas.destination import DestinationOut

router = APIRouter(prefix="/destinations", tags=["destinations"])

@router.get("/search")
async def search_destinations(q: str = Query(default="", max_length=100), db: Session = Depends(get_db)):
    normalized = q.strip().lower(); cache_key = f"destinations:global:v2:{normalized}"
    cached = await cache.get(cache_key)
    if cached is not None: return success(cached, {"cached": True, "attribution": "© OpenStreetMap contributors · Photon"})
    statement = select(Destination)
    if normalized:
        pattern = f"%{normalized}%"
        statement = statement.where(or_(Destination.name.ilike(pattern), Destination.country.ilike(pattern), Destination.slug.ilike(pattern)))
    destinations = list(db.scalars(statement.order_by(Destination.name).limit(8)).all())
    if len(normalized) >= 2:
        try:
            results = await search_places(q.strip())
        except (httpx.HTTPError, ValueError, TypeError):
            raise HTTPException(status_code=503, detail="Worldwide location search is temporarily unavailable. Please try again shortly.")
        local_matches = destinations
        destinations = [item for item in local_matches if item.name.lower() == normalized]
        seen = {item.id for item in destinations}
        for result in results:
            item = db.get(Destination, result['id'])
            if item is None:
                try:
                    with db.begin_nested():
                        item = Destination(**result); db.add(item); db.flush()
                except IntegrityError:
                    item = db.get(Destination, result['id'])
            if item and item.id not in seen:
                # Keep existing city references first, but include new worldwide results.
                if not any(abs(old.latitude-item.latitude) < .02 and abs(old.longitude-item.longitude) < .02 and old.name.lower() == item.name.lower() for old in destinations):
                    destinations.append(item); seen.add(item.id)
        destinations.extend(item for item in local_matches if item.id not in seen)
        db.commit()
    data = [DestinationOut.model_validate(item).model_dump(mode="json") for item in destinations[:16]]
    await cache.set(cache_key, data, 86400)
    return success(data, {"cached": False, "count": len(data), "attribution": "© OpenStreetMap contributors · Photon"})

@router.get("/{destination_id}")
def get_destination(destination_id: uuid.UUID, db: Session = Depends(get_db)):
    destination = db.get(Destination, destination_id)
    if not destination: raise HTTPException(status_code=404, detail="Destination not found")
    return success(DestinationOut.model_validate(destination).model_dump(mode="json"))
