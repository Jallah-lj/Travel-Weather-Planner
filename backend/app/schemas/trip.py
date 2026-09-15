from app.schemas.journey import TripStopInput, validate_stop_schedule
from app.schemas.plan import InitialPlan
import uuid
from datetime import date
from pydantic import BaseModel, Field, model_validator

class TripCreate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=180)
    initial_plan: InitialPlan | None = None
    request_id: uuid.UUID | None = None
    destination_id: uuid.UUID | None = None
    stops: list[TripStopInput] | None = Field(default=None, min_length=1, max_length=12)
    departure_date: date
    return_date: date
    travel_style: str = Field(default="relaxed", pattern="^(relaxed|adventure|business|family|romantic|backpacking)$")
    activities: list[str] = Field(default_factory=list, max_length=12)
    @model_validator(mode="after")
    def validate_dates(self):
        if self.stops:
            validate_stop_schedule(self.stops, self.departure_date, self.return_date)
            if self.destination_id and self.destination_id != self.stops[0].destination_id: raise ValueError('Primary destination must match the first stop')
            self.destination_id = self.stops[0].destination_id
        if self.destination_id is None: raise ValueError('Choose at least one destination')
        if self.return_date < self.departure_date: raise ValueError("Return date must be on or after departure date")
        if (self.return_date - self.departure_date).days > 60: raise ValueError("Trips cannot exceed 60 days")
        if self.initial_plan is not None:
            expected = (self.return_date - self.departure_date).days + 1
            dates = [day.date for day in self.initial_plan.itinerary]
            if len(dates) != expected or len(set(dates)) != expected or any(not self.departure_date <= day <= self.return_date for day in dates):
                raise ValueError('The draft must include every trip date exactly once')
            ids = [item.id for day in self.initial_plan.itinerary for item in day.items]
            packing_ids = [item.id for item in self.initial_plan.packing]
            if len(ids) != len(set(ids)) or len(packing_ids) != len(set(packing_ids)):
                raise ValueError('Draft item identifiers must be unique')
        return self

class TripUpdate(BaseModel):
    departure_date: date | None = None
    return_date: date | None = None
    travel_style: str | None = None
    activities: list[str] | None = None

class AIChatRequest(BaseModel):
    trip_id: str
    message: str = Field(min_length=2, max_length=1000)
