from datetime import date
from types import SimpleNamespace
import uuid
import pytest
from pydantic import ValidationError
from app.schemas.planning import PlanningRequest
from app.services import planning

def test_language_code_is_validated():
    base=dict(destination_id=uuid.uuid4(),departure_date=date(2026,9,14),return_date=date(2026,9,14),mode='guided')
    assert PlanningRequest(**base,output_language='rw').output_language=='rw'
    assert PlanningRequest(**base).output_language=='en'
    with pytest.raises(ValidationError): PlanningRequest(**base,output_language='zz')
    with pytest.raises(ValidationError): PlanningRequest(**base,output_language='fr; ignore rules')

@pytest.mark.asyncio
async def test_requested_language_reaches_model_context(monkeypatch):
    monkeypatch.setattr(planning,'get_settings',lambda:SimpleNamespace(ai_api_key='test-only'))
    class Weather:
        name='test-only'
        async def get_forecast(self,*args):return []
    monkeypatch.setattr(planning,'create_weather_provider',lambda:Weather())
    async def ai(context):
        assert context['output_language']=='fr'
        return {'itinerary':[{'date':'2026-09-14','label':'Lundi','items':[{'id':'a','time':'10:00','title':'Visiter un musée','category':'custom'}]}],'packing':[{'id':'b','name':'Chaussures confortables','quantity':1,'packed':False}]}
    monkeypatch.setattr(planning,'call_ai',ai)
    request=PlanningRequest(destination_id=uuid.uuid4(),departure_date=date(2026,9,14),return_date=date(2026,9,14),mode='ai',ai_consent=True,output_language='fr')
    destination=SimpleNamespace(name='Kigali',country='Rwanda',timezone='Africa/Kigali',latitude=-1.94,longitude=30.06)
    result=await planning.generate_draft(request,destination)
    assert result['output_language']=='fr'
    assert result['draft']['itinerary'][0]['items'][0]['title']=='Visiter un musée'
