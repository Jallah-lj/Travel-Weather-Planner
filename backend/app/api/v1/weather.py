from datetime import date
from fastapi import APIRouter, Query
from app.core.cache import cache
from app.core.responses import success
from app.providers.factory import create_weather_provider

router = APIRouter(prefix="/weather", tags=["weather"])
provider = create_weather_provider()

@router.get("/current")
async def current_weather(latitude: float = Query(ge=-90, le=90), longitude: float = Query(ge=-180, le=180)):
    key = f"weather:{provider.name}:current:{latitude:.3f}:{longitude:.3f}"; cached = await cache.get(key)
    if cached: return success(cached, {"provider": provider.name, "cached": True})
    data = await provider.get_current_weather(latitude, longitude); await cache.set(key, data, 600)
    return success(data, {"provider": provider.name, "cached": False})

@router.get("/forecast")
async def daily_forecast(latitude: float = Query(ge=-90, le=90), longitude: float = Query(ge=-180, le=180), start_date: date = Query(default_factory=date.today), days: int = Query(default=7, ge=1, le=16)):
    key = f"weather:{provider.name}:daily:{latitude:.3f}:{longitude:.3f}:{start_date}:{days}"; cached = await cache.get(key)
    if cached: return success(cached, {"provider": provider.name, "cached": True})
    data = await provider.get_forecast(latitude, longitude, start_date, days); await cache.set(key, data, 1800)
    return success(data, {"provider": provider.name, "cached": False})

@router.get("/hourly")
async def hourly_forecast(latitude: float = Query(ge=-90, le=90), longitude: float = Query(ge=-180, le=180), target_date: date = Query(default_factory=date.today)):
    key = f"weather:{provider.name}:hourly:{latitude:.3f}:{longitude:.3f}:{target_date}"; cached = await cache.get(key)
    if cached: return success(cached, {"provider": provider.name, "cached": True})
    data = await provider.get_hourly_forecast(latitude, longitude, target_date); await cache.set(key, data, 900)
    return success(data, {"provider": provider.name, "cached": False})
