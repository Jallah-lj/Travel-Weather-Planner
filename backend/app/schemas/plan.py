from app.schemas.routing import GoogleLocation, TravelMode
from datetime import date
from pydantic import BaseModel, Field
class PlanItem(BaseModel):
    location: GoogleLocation | None = None
    duration_minutes: int | None = Field(default=None, ge=0, le=1440)
    id: str = Field(min_length=1, max_length=80)
    time: str = Field(pattern=r'^([01]\d|2[0-3]):[0-5]\d$')
    title: str = Field(min_length=1, max_length=180)
    category: str = Field(default='custom', max_length=64)
class PlanDay(BaseModel):
    travel_mode: TravelMode = "DRIVE"
    date: date
    label: str = Field(max_length=40)
    headline: str = Field(default='Your itinerary', max_length=120)
    items: list[PlanItem] = Field(max_length=50)
class PackItem(BaseModel):
    id: str = Field(min_length=1, max_length=80)
    name: str = Field(min_length=1, max_length=180)
    category: str = Field(default='My essentials', max_length=80)
    quantity: int = Field(ge=1, le=99)
    packed: bool = False
    reason: str | None = Field(default=None, max_length=255)
class PlanUpdate(BaseModel):
    revision: int = Field(ge=1)
    itinerary: list[PlanDay] = Field(max_length=61)
    packing: list[PackItem] = Field(max_length=300)

class InitialPlan(BaseModel):
    itinerary: list[PlanDay] = Field(max_length=61)
    packing: list[PackItem] = Field(max_length=300)
