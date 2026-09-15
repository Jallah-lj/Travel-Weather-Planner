"""Worldwide OSM place search. Public Photon is for moderate preview usage only."""
import asyncio
import math
import time
import uuid
import httpx
from timezonefinder import TimezoneFinder
from app.core.config import get_settings

_lock = asyncio.Lock()
_last_request = 0.0
_zones = TimezoneFinder()

async def search_places(query: str) -> list[dict]:
    global _last_request
    async with _lock:
        await asyncio.sleep(max(0, 1 - (time.monotonic() - _last_request)))
        _last_request = time.monotonic()
        async with httpx.AsyncClient(timeout=12) as client:
            response = await client.get(get_settings().geocoding_url, params={"q": query, "limit": 8, "lang": "en"}, headers={"User-Agent": "TravelWeatherPlanner/1.0"})
            response.raise_for_status()
            payload = response.json()
    return [item for feature in payload.get("features", []) if (item := normalize_place(feature))]

def normalize_place(feature: dict) -> dict | None:
    try:
        p = feature['properties']; lon, lat = feature['geometry']['coordinates']
        if not all(isinstance(v, (float, int)) and math.isfinite(v) for v in (lat, lon)) or not (-90 <= lat <= 90 and -180 <= lon <= 180): return None
        name = p.get('name') or p.get('street')
        if not name: return None
        code = p.get('countrycode', '').upper()
        if len(code) != 2 or not code.isascii() or not code.isalpha(): code = ''
        slug = f"photon-{p['osm_type']}-{p['osm_id']}".lower()
        return dict(id=uuid.uuid5(uuid.NAMESPACE_URL, slug), slug=slug, name=name[:120], country=(p.get('country') or 'Country not specified')[:120], country_code=code, flag=''.join(chr(127397 + ord(c)) for c in code) if code else '🌍', latitude=lat, longitude=lon, timezone=_zones.timezone_at(lat=lat, lng=lon) or 'UTC', destination_type=str(p.get('osm_value') or p.get('type') or 'place')[:32])
    except (KeyError, TypeError, ValueError): return None
