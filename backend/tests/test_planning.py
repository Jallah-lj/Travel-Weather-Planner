import uuid
from types import SimpleNamespace
from datetime import date
from fastapi import HTTPException
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
import pytest
from app.main import app
from app.core.database import Base, get_db
from app.core.cache import cache
from app.models.entities import Destination, Trip
from app.schemas.planning import PlanningRequest
from app.services import planning

@pytest.fixture
def planner_setup(tmp_path):
    engine=create_engine(f'sqlite:///{tmp_path}/planner.db',connect_args={'check_same_thread':False})
    Base.metadata.create_all(engine); sessions=sessionmaker(engine)
    def get_test_db():
        with sessions() as db: yield db
    app.dependency_overrides[get_db]=get_test_db; cache.memory.clear()
    dest=uuid.uuid4()
    with sessions() as db:
        db.add(Destination(id=dest,slug='kigali',name='Kigali',country='Rwanda',country_code='RW',flag='🇷🇼',timezone='Africa/Kigali',latitude=-1.9441,longitude=30.0619));db.commit()
    with TestClient(app) as client:
        session=client.post('/api/v1/auth/register',json={'email':'planner@example.com','password':'Planner-testing-password42','display_name':'Planner'}).json()['data']
        yield client, {'Authorization':'Bearer '+session['access_token']}, str(dest), sessions
    app.dependency_overrides.clear();engine.dispose()

def test_reviewed_draft_is_atomic_private_and_idempotent(planner_setup):
    client,headers,dest,sessions=planner_setup
    payload={'title':'My carefully planned weekend','request_id':str(uuid.uuid4()),'destination_id':dest,'departure_date':'2026-09-14','return_date':'2026-09-14','initial_plan':{'itinerary':[{'date':'2026-09-14','label':'Monday','items':[{'id':'a','time':'10:30','title':'My museum visit','category':'custom'}]}],'packing':[{'id':'p','name':'Rain jacket','quantity':1,'packed':False}]}}
    assert client.post('/api/v1/trips',json=payload).status_code==401
    assert client.get('/api/v1/ai/planning-options',headers={'X-App-Token':headers['Authorization'].split(' ',1)[1]}).status_code==200
    assert client.get('/api/v1/ai/planning-options',headers={'X-App-Token':'invalid-token'}).status_code==401
    response=client.post('/api/v1/trips',headers=headers,json=payload)
    assert response.status_code==201,response.text
    trip=response.json()['data']['id']
    repeated=client.post('/api/v1/trips',headers=headers,json=payload)
    assert repeated.json()['data']['id']==trip
    plan=client.get(f'/api/v1/trips/{trip}/plan',headers=headers).json()['data']
    assert plan['title']==payload['title']
    assert plan['itinerary'][0]['items'][0]['title']=='My museum visit'
    assert plan['packing'][0]['name']=='Rain jacket'
    assert len(client.get('/api/v1/trips',headers=headers).json()['data'])==1
    payload['request_id']=str(uuid.uuid4());payload['initial_plan']['itinerary'][0]['date']='2026-09-15'
    assert client.post('/api/v1/trips',headers=headers,json=payload).status_code==422
    with sessions() as db: assert len(db.scalars(select(Trip)).all())==1

class Weather:
    name='test_forecast'
    async def get_forecast(self,*args):
        return [{'date':'2026-09-14','rain_probability':85,'low':10,'high':19,'uv':2}]

def test_missing_ai_key_is_explicit_and_guided_not_ai(planner_setup,monkeypatch):
    client,headers,dest,sessions=planner_setup
    monkeypatch.setattr(planning,'get_settings',lambda:SimpleNamespace(ai_api_key=''))
    monkeypatch.setattr(planning,'create_weather_provider',lambda:Weather())
    payload={'destination_id':dest,'departure_date':'2026-09-14','return_date':'2026-09-15','mode':'ai','ai_consent':True,'activities':['walking'],'pace':'easy'}
    assert client.post('/api/v1/ai/plan-draft',headers=headers,json=payload).status_code==503
    payload['mode']='guided'
    response=client.post('/api/v1/ai/plan-draft',headers=headers,json=payload)
    assert response.status_code==200,response.text
    data=response.json()['data'];assert data['source']=='Rule-based suggestions'
    assert data['draft']['itinerary'][0]['items'][0]['category']=='indoor'
    assert len(data['draft']['itinerary'])==2
    assert any('forecast window' in x for x in data['warnings'])
    assert client.get('/api/v1/trips',headers=headers).json()['data']==[]
    payload['return_date']='2026-10-15'
    assert client.post('/api/v1/ai/plan-draft',headers=headers,json=payload).status_code==422

@pytest.mark.asyncio
async def test_ai_output_is_validated_and_not_silently_substituted(monkeypatch):
    monkeypatch.setattr(planning,'get_settings',lambda:SimpleNamespace(ai_api_key='test-only'))
    monkeypatch.setattr(planning,'create_weather_provider',lambda:Weather())
    request=PlanningRequest(destination_id=uuid.uuid4(),departure_date=date(2026,9,14),return_date=date(2026,9,14),mode='ai',ai_consent=True)
    destination=SimpleNamespace(name='Kigali',country='Rwanda',timezone='Africa/Kigali',latitude=-1.94,longitude=30.06)
    async def ai(context):
        assert 'email' not in context and context['dates']==['2026-09-14']
        return {'itinerary':[{'date':'2026-09-14','label':'Monday','items':[{'id':'ai1','time':'09:00','title':'Visit a local gallery','category':'indoor'}]}],'packing':[]}
    monkeypatch.setattr(planning,'call_ai',ai)
    result=await planning.generate_draft(request,destination)
    assert result['source']=='AI-generated draft'
    async def bad(context):return {'itinerary':[],'packing':[]}
    monkeypatch.setattr(planning,'call_ai',bad)
    with pytest.raises(HTTPException) as error:await planning.generate_draft(request,destination)
    assert error.value.status_code==502
