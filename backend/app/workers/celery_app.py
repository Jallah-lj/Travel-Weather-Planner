from celery import Celery
from app.core.config import get_settings

settings = get_settings()
celery_app = Celery("travel_weather", broker=settings.redis_url, backend=settings.redis_url)
celery_app.conf.update(task_serializer="json", accept_content=["json"], result_serializer="json", timezone="UTC", enable_utc=True, beat_schedule={"refresh-upcoming-trip-weather": {"task": "app.workers.tasks.refresh_upcoming_weather", "schedule": 1800.0}, "detect-forecast-changes": {"task": "app.workers.tasks.detect_forecast_changes", "schedule": 900.0}})
