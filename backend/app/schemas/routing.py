from datetime import date
from typing import Literal
from uuid import UUID
from pydantic import BaseModel, Field

TravelMode = Literal['DRIVE', 'WALK', 'BICYCLE']
class GoogleLocation(BaseModel):
    provider: Literal['google'] = 'google'
    place_id: str = Field(min_length=3, max_length=256, pattern=r'^[A-Za-z0-9_-]+$')
class PlaceSearch(BaseModel):
    query: str = Field(min_length=2, max_length=150)
    session_token: UUID
    day_date: date
class PlaceDetails(BaseModel):
    place_id: str = Field(min_length=3, max_length=256, pattern=r'^[A-Za-z0-9_-]+$')
    session_token: UUID | None = None
class RouteRequest(BaseModel):
    revision: int = Field(ge=1)
    day_date: date
    buffer_minutes: int = Field(default=10, ge=0, le=120)
