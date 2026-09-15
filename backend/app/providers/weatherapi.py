from datetime import date
from typing import Any
from app.providers.base import WeatherProvider

class WeatherAPIProvider(WeatherProvider):
    name = "weatherapi"
    def __init__(self, api_key: str) -> None:
        if not api_key: raise ValueError("WEATHER_API_KEY is required for WeatherAPI")
        self.api_key = api_key
    async def get_current_weather(self, latitude: float, longitude: float) -> dict[str, Any]:
        raise NotImplementedError("WeatherAPI adapter is reserved for provider failover")
    async def get_forecast(self, latitude: float, longitude: float, start_date: date, days: int = 7) -> list[dict[str, Any]]:
        raise NotImplementedError("WeatherAPI adapter is reserved for provider failover")
    async def get_hourly_forecast(self, latitude: float, longitude: float, target_date: date) -> list[dict[str, Any]]:
        raise NotImplementedError("WeatherAPI adapter is reserved for provider failover")
    async def get_weather_alerts(self, latitude: float, longitude: float) -> list[dict[str, Any]]:
        raise NotImplementedError("WeatherAPI adapter is reserved for provider failover")
