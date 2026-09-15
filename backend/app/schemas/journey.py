import uuid
from datetime import date, timedelta
from pydantic import BaseModel, Field, model_validator

class TripStopInput(BaseModel):
    destination_id: uuid.UUID
    arrival_date: date
    departure_date: date

def validate_stop_schedule(stops, start=None, end=None):
    if not 1 <= len(stops) <= 12: raise ValueError('A trip must have between 1 and 12 stops')
    if (stops[-1].departure_date - stops[0].arrival_date).days > 60: raise ValueError('Trips cannot exceed 61 calendar days')
    for index, stop in enumerate(stops):
        if stop.departure_date < stop.arrival_date: raise ValueError(f'Stop {index+1}: last day must be on or after arrival')
        if index:
            expected = stops[index-1].departure_date + timedelta(days=1)
            if stop.arrival_date < expected: raise ValueError(f'Stop {index+1} overlaps the previous stop. Assign each calendar day to one destination.')
            if stop.arrival_date > expected: raise ValueError(f'There is a gap before stop {index+1}. Assign travel days to the arriving destination.')
    if start is not None and stops[0].arrival_date != start: raise ValueError('The first stop must start on the trip departure date')
    if end is not None and stops[-1].departure_date != end: raise ValueError('The last stop must end on the trip return date')
    return stops

class StopsUpdate(BaseModel):
    revision: int = Field(ge=1)
    stops: list[TripStopInput] = Field(min_length=1, max_length=12)
    confirm_reassignment: bool = False
    @model_validator(mode='after')
    def validate_schedule(self):
        validate_stop_schedule(self.stops)
        return self
