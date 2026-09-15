from functools import lru_cache
from typing import Literal
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    app_name: str = "Travel Weather Planner API"
    environment: Literal["development", "test", "production"] = "development"
    auth_provider: Literal["local", "supabase"] = "local"
    supabase_url: str = ""
    supabase_publishable_key: str = ""
    database_migration_url: str = ""
    database_null_pool: bool = False
    database_url: str = "sqlite:///./travel_weather.db"
    redis_url: str = "redis://localhost:6379/0"
    secret_key: str = "development-only-change-me"
    weather_provider: str = "openmeteo"
    open_meteo_url: str = "https://api.open-meteo.com/v1/forecast"
    geocoding_url: str = "https://photon.komoot.io/api/"
    weather_api_key: str = ""
    ai_provider: Literal["openai", "gemini"] = "openai"
    gemini_api_url: str = "https://generativelanguage.googleapis.com/v1beta"
    ai_api_key: str = ""
    ai_model: str = "gpt-4.1-mini"
    ai_api_url: str = "https://api.openai.com/v1/chat/completions"
    google_maps_legal_approved: bool = False
    google_maps_server_key: str = ""
    google_maps_browser_key: str = ""
    google_routes_per_user_minute: int = 6
    google_routes_per_user_day: int = 100
    google_routes_per_day: int = 1000
    google_places_per_user_minute: int = 30
    google_places_per_user_day: int = 300
    google_places_per_day: int = 3000
    access_token_minutes: int = 30
    refresh_token_days: int = 14
    allowed_origins: str = "http://localhost:5173"
    log_level: str = "INFO"
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    @property
    def cors_origins(self) -> list[str]:
        return [v.strip() for v in self.allowed_origins.split(",") if v.strip()]

    def validate_production(self) -> None:
        import os
        if os.environ.get("VERCEL") == "1" and self.environment != "production":
            raise RuntimeError("Vercel deployments must explicitly set ENVIRONMENT=production")
        if self.google_maps_server_key and self.google_maps_server_key == self.google_maps_browser_key:
            raise RuntimeError("Use separate server-restricted and browser-restricted Google Maps keys")
        endpoint = self.gemini_api_url if self.ai_provider == "gemini" else self.ai_api_url
        if self.ai_api_key and not endpoint.startswith("https://"):
            raise RuntimeError("AI_API_URL must use HTTPS")
        if self.environment == "production":
            from urllib.parse import urlsplit
            required_values=(self.supabase_url,self.supabase_publishable_key,self.database_url,self.redis_url,self.secret_key,self.allowed_origins)
            if any(any(marker in value.upper() for marker in ("REPLACE", "YOUR_", "PROJECT_REF", "ENCODED_PASSWORD", "POOLER_HOST", "REDIS_HOST")) for value in required_values):
                raise RuntimeError("Replace production environment placeholders before deploying")
            if self.auth_provider != "supabase":
                raise RuntimeError("Production requires Supabase Auth")
            if not self.supabase_url.startswith("https://") or not self.supabase_publishable_key:
                raise RuntimeError("Supabase HTTPS URL and publishable key are required")
            if not self.database_url.startswith("postgresql+psycopg://") or "sslmode=" not in self.database_url:
                raise RuntimeError("Production requires PostgreSQL/psycopg with explicit TLS")
            from sqlalchemy.engine import make_url
            db_url = make_url(self.database_url)
            if db_url.query.get("sslmode") not in ("require", "verify-ca", "verify-full"):
                raise RuntimeError("Database TLS must not be disabled")
            if not self.redis_url.startswith("rediss://"):
                raise RuntimeError("Production requires shared Redis over TLS (rediss://)")
            if not self.cors_origins or any(not origin.startswith("https://") or "*" in origin or urlsplit(origin).path not in ("", "/") for origin in self.cors_origins):
                raise RuntimeError("Set exact HTTPS frontend origins, not wildcards")
            if len(self.secret_key) < 32:
                raise RuntimeError("SECRET_KEY must contain at least 32 characters")
        if self.environment == "production" and self.secret_key == "development-only-change-me":
            raise RuntimeError("SECRET_KEY must be changed in production")
        if self.environment == "production" and self.weather_provider == "mock":
            raise RuntimeError("A production weather provider is required")

@lru_cache
def get_settings() -> Settings:
    return Settings()
