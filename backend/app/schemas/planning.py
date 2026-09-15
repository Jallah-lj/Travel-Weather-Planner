import json
from pathlib import Path
from datetime import date
from typing import Literal
from pydantic import BaseModel, Field, model_validator, field_validator
from app.schemas.plan import PlanDay, PackItem, InitialPlan
from app.schemas.trip import TripCreate

LANGUAGE_CODES = set(json.loads((Path(__file__).resolve().parents[1] / 'data' / 'languages.json').read_text()))

class PlanningRequest(TripCreate):
    output_language: str = Field(default='en', min_length=2, max_length=2)
    @field_validator('output_language')
    @classmethod
    def supported_language(cls, value):
        if value not in LANGUAGE_CODES: raise ValueError('Choose a supported language code')
        return value
    mode: Literal['ai', 'guided'] = 'ai'
    pace: Literal['easy', 'balanced', 'active'] = 'balanced'
    notes: str = Field(default='', max_length=1500)
    ai_consent: bool = False
    @model_validator(mode='after')
    def drafting_limits(self):
        if (self.return_date-self.departure_date).days >= 14:
            raise ValueError('Assisted drafts support up to 14 days. Use manual planning for longer trips.')
        if self.mode == 'ai' and not self.ai_consent:
            raise ValueError('Confirm consent before sending your planning details to the AI provider.')
        return self
