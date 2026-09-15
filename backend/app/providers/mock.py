"""Deterministic development provider. It is never selected implicitly in production."""
import math
from datetime import date, timedelta
from typing import Any
from app.providers.base import WeatherProvider

class DevelopmentMockWeatherProvider(WeatherProvider):
    name = "development_mock"
    async def get_current_weather(self, latitude: float, longitude: float) -> dict[str, Any]:
        tropical = abs(latitude) < 15
        return {"temperature": 27 if tropical else 23, "feels_like": 27 if tropical else 24, "condition": "Mostly sunny", "icon": "partly_cloudy", "humidity": 58, "wind": 12, "visibility": 10, "uv": 6, "precipitation": 18, "observed_at": "2026-08-25T10:00:00Z"}

    async def get_forecast(self, latitude: float, longitude: float, start_date: date, days: int = 7) -> list[dict[str, Any]]:
        sequence = [
            (27, 18, 14, "Mostly sunny", "sun"), (28, 18, 22, "Sun and clouds", "partly_cloudy"),
            (26, 17, 48, "Afternoon showers", "rain"), (25, 17, 31, "Partly cloudy", "partly_cloudy"),
            (27, 18, 12, "Sunny", "sun"), (28, 18, 18, "Mostly sunny", "sun"), (26, 17, 36, "Clouds and showers", "rain")]
        result = []
        for index in range(days):
            high, low, rain, condition, icon = sequence[index % len(sequence)]
            when = start_date + timedelta(days=index)
            result.append({"date": when.isoformat(), "day": when.strftime("%a").upper(), "high": high, "low": low, "rain_probability": rain, "condition": condition, "icon": icon, "humidity": 56 + index, "wind": 10 + (index % 3) * 2, "visibility": 10, "uv": max(3, 7 - index % 4)})
        return result

    async def get_hourly_forecast(self, latitude: float, longitude: float, target_date: date) -> list[dict[str, Any]]:
        result = []
        for hour in range(8, 20):
            temperature = round(19 + 8 * math.sin((hour - 7) / 13 * math.pi))
            rain = 8 if hour < 15 else 12 + (hour - 14) * 7
            result.append({"time": f"{hour:02d}:00", "temperature": temperature, "feels_like": temperature + (1 if 12 <= hour <= 15 else 0), "precipitation": min(rain, 58), "wind": 8 + hour % 5, "uv": max(0, 7 - abs(hour - 13)), "icon": "sun" if hour < 15 else "partly_cloudy" if hour < 17 else "rain"})
        return result

    async def get_weather_alerts(self, latitude: float, longitude: float) -> list[dict[str, Any]]:
        return []
