from abc import ABC, abstractmethod
from datetime import date
from typing import Any

class WeatherProvider(ABC):
    """Provider contract. Implementations must return normalized, provider-agnostic dictionaries."""
    name: str
    @abstractmethod
    async def get_current_weather(self, latitude: float, longitude: float) -> dict[str, Any]: ...
    @abstractmethod
    async def get_forecast(self, latitude: float, longitude: float, start_date: date, days: int = 7) -> list[dict[str, Any]]: ...
    @abstractmethod
    async def get_hourly_forecast(self, latitude: float, longitude: float, target_date: date) -> list[dict[str, Any]]: ...
    @abstractmethod
    async def get_weather_alerts(self, latitude: float, longitude: float) -> list[dict[str, Any]]: ...
