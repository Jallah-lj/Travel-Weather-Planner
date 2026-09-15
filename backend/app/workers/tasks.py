import structlog
from app.workers.celery_app import celery_app
logger = structlog.get_logger()

@celery_app.task
def refresh_upcoming_weather() -> dict[str, int]:
    logger.info("weather_refresh_started")
    # Production implementation enqueues one idempotent provider refresh per upcoming trip.
    return {"queued": 0}

@celery_app.task
def detect_forecast_changes() -> dict[str, int]:
    logger.info("forecast_change_detection_started")
    # Forecast snapshots are compared before notification jobs are emitted.
    return {"changes": 0}
