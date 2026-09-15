from datetime import date
from typing import Any
import httpx
from app.providers.base import WeatherProvider

class OpenWeatherProvider(WeatherProvider):
    name = "openweather"
    def __init__(self, api_key: str) -> None:
        if not api_key:
            raise ValueError("WEATHER_API_KEY is required for OpenWeather")
        self.api_key = api_key
        self.base_url = "https://api.openweathermap.org/data/3.0"

    async def _one_call(self, latitude: float, longitude: float) -> dict[str, Any]:
        async with httpx.AsyncClient(timeout=12.0) as client:
            response = await client.get(f"{self.base_url}/onecall", params={"lat": latitude, "lon": longitude, "appid": self.api_key, "units": "metric", "exclude": "minutely"})
            response.raise_for_status()
            return response.json()

    async def get_current_weather(self, latitude: float, longitude: float) -> dict[str, Any]:
        raw = (await self._one_call(latitude, longitude))["current"]
        return {"temperature": round(raw["temp"]), "feels_like": round(raw["feels_like"]), "condition": raw["weather"][0]["description"].title(), "icon": self._icon(raw["weather"][0]["id"]), "humidity": raw["humidity"], "wind": round(raw["wind_speed"] * 3.6), "visibility": round(raw.get("visibility", 10000) / 1000, 1), "uv": round(raw.get("uvi", 0)), "precipitation": round(raw.get("rain", {}).get("1h", 0) * 10)}

    async def get_forecast(self, latitude: float, longitude: float, start_date: date, days: int = 7) -> list[dict[str, Any]]:
        raw = (await self._one_call(latitude, longitude))["daily"][:days]
        return [{"date": date.fromtimestamp(d["dt"]).isoformat(), "day": date.fromtimestamp(d["dt"]).strftime("%a").upper(), "high": round(d["temp"]["max"]), "low": round(d["temp"]["min"]), "rain_probability": round(d.get("pop", 0) * 100), "condition": d["weather"][0]["description"].title(), "icon": self._icon(d["weather"][0]["id"]), "humidity": d["humidity"], "wind": round(d["wind_speed"] * 3.6), "visibility": 10, "uv": round(d.get("uvi", 0))} for d in raw]

    async def get_hourly_forecast(self, latitude: float, longitude: float, target_date: date) -> list[dict[str, Any]]:
        raw = (await self._one_call(latitude, longitude))["hourly"][:24]
        return [{"time": __import__("datetime").datetime.fromtimestamp(h["dt"]).strftime("%H:%M"), "temperature": round(h["temp"]), "feels_like": round(h["feels_like"]), "precipitation": round(h.get("pop", 0) * 100), "wind": round(h["wind_speed"] * 3.6), "uv": round(h.get("uvi", 0)), "icon": self._icon(h["weather"][0]["id"])} for h in raw]

    async def get_weather_alerts(self, latitude: float, longitude: float) -> list[dict[str, Any]]:
        return (await self._one_call(latitude, longitude)).get("alerts", [])

    @staticmethod
    def _icon(code: int) -> str:
        if code < 300: return "storm"
        if code < 600: return "rain"
        if code < 700: return "snow"
        if code == 800: return "sun"
        return "partly_cloudy"
