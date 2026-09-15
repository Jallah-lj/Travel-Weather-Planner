import uuid
from pydantic import BaseModel, ConfigDict

class DestinationOut(BaseModel):
    id: uuid.UUID
    name: str
    country: str
    country_code: str
    flag: str
    timezone: str
    latitude: float
    longitude: float
    destination_type: str = "city"
    model_config = ConfigDict(from_attributes=True)
