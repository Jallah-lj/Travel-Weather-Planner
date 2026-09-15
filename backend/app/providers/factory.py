from app.providers.openmeteo import OpenMeteoProvider
from app.core.config import Settings, get_settings
from app.providers.base import WeatherProvider
from app.providers.mock import DevelopmentMockWeatherProvider
from app.providers.openweather import OpenWeatherProvider
from app.providers.weatherapi import WeatherAPIProvider

def create_weather_provider(settings: Settings | None = None) -> WeatherProvider:
    settings = settings or get_settings()
    provider = settings.weather_provider.lower()
    if provider == "openmeteo": return OpenMeteoProvider()
    if provider == "mock":
        if settings.environment == "production": raise RuntimeError("Development mock weather provider is disabled in production")
        return DevelopmentMockWeatherProvider()
    if provider == "openweather": return OpenWeatherProvider(settings.weather_api_key)
    if provider == "weatherapi": return WeatherAPIProvider(settings.weather_api_key)
    raise ValueError(f"Unsupported weather provider: {provider}")
