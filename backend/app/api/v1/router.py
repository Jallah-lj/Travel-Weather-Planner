from fastapi import APIRouter
from app.api.v1 import ai, auth, destinations, trips, weather, sharing, exports, routing

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(destinations.router)
api_router.include_router(weather.router)
api_router.include_router(trips.router)
api_router.include_router(ai.router)

api_router.include_router(sharing.router)
api_router.include_router(exports.router)
api_router.include_router(routing.router)
