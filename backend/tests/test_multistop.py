import uuid
from datetime import date
from types import SimpleNamespace
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
from app.main import app
from app.core.database import Base, get_db
from app.core.cache import cache
from app.models.entities import Destination, Trip, TripDestination
from app.schemas.planning import PlanningRequest
from app.services import planning

@pytest.fixture
def journey_setup(tmp_path):
    engine=create_engine(f'sqlite:///{tmp_path}/journey.db',connect_args={'check_same_thread':False})
    Base.metadata.create_all(engine); sessions=sessionmaker(engine)
    def db_override():
        with sessions() as db: yield db
    app.dependency_overrides[get_db]=db_override;cache.memory.clear()
    ids=[]
    with sessions() as db:
        for name,country,code,tz,lat,lon in [('Kigali','Rwanda','RW','Africa/Kigali',-1.9441,30.0619),('Nairobi','Kenya','KE','Africa/Nairobi',-1.2921,36.8219),('New York','United States','US','America/New_York',40.7128,-74.006)]:
            item=Destination(slug=name.lower().replace(' ','-'),name=name,country=country,country_code=code,flag='🌍',timezone=tz,latitude=lat,longitude=lon)
            db.add(item);db.flush();ids.append(str(item.id))
        db.commit()
    with TestClient(app) as client:
        def register(name):
            result=client.post('/api/v1/auth/register',json={'email':name+'@example.com','password':'Multi-stop-password42','display_name':name})
            return {'Authorization':'Bearer '+result.json()['data']['access_token']}
        yield client,register('owner'),register('other'),ids,sessions
    app.dependency_overrides.clear();engine.dispose()

def payload(ids):
    return {'title':'Across three cities','departure_date':'2026-09-15','return_date':'2026-09-17','stops':[{'destination_id':id,'arrival_date':f'2026-09-{15+i}','departure_date':f'2026-09-{15+i}'} for i,id in enumerate(ids)]}

def test_multi_stop_schedule_privacy_exports_and_edit_conflicts(journey_setup):
    client,owner,other,ids,sessions=journey_setup
    body=payload(ids)
    response=client.post('/api/v1/trips',headers=owner,json=body)
    assert response.status_code==201,response.text
    path='/api/v1/trips/'+response.json()['data']['id']
    data=client.get(path+'/plan',headers=owner).json()['data']
    assert [s['destination']['name'] for s in data['stops']]==['Kigali','Nairobi','New York']
    for day in data['itinerary']:day['items']=[{'id':day['date'],'title':'Local activity','time':'10:00','category':'custom'}]
    assert client.put(path+'/plan',headers=owner,json=data).status_code==200
    ics=client.get(path+'/export/calendar',headers=owner).text
    assert 'DTSTART:20260915T080000Z' in ics
    assert 'DTSTART:20260916T070000Z' in ics
    assert 'DTSTART:20260917T140000Z' in ics
    assert 'LOCATION:New York' in ics
    html=client.get(path+'/export/offline',headers=owner).text
    assert 'America/New_York' in html and 'Africa/Nairobi' in html
    data=client.get(path+'/plan',headers=owner).json()['data']
    changed={'revision':data['revision'],'stops':body['stops'],'confirm_reassignment':False}
    changed['stops'][1]['destination_id']=ids[0]
    assert client.put(path+'/stops',headers=other,json=changed).status_code==404
    assert client.put(path+'/stops',json=changed).status_code==401
    assert client.put(path+'/stops',headers=owner,json=changed).status_code==422
    changed['confirm_reassignment']=True
    updated=client.put(path+'/stops',headers=owner,json=changed)
    assert updated.status_code==200,updated.text
    assert updated.json()['data']['revision']==data['revision']+1
    assert updated.json()['data']['itinerary'][1]['items'][0]['title']=='Local activity'
    assert client.put(path+'/stops',headers=owner,json=changed).status_code==409
    # Do not silently delete the final day's activity when shortening the journey.
    changed['revision']+=1;changed['stops']=changed['stops'][:2]
    assert client.put(path+'/stops',headers=owner,json=changed).status_code==422
    link=client.post(path+'/shares',headers=owner,json={'permission':'edit'}).json()['data']['token']
    assert client.put(path+'/stops',headers={'X-Trip-Share':link},json=changed).status_code==401
    assert len(client.get('/api/v1/shared/plan',headers={'X-Trip-Share':link}).json()['data']['plan']['stops'])==3
    assert client.put(path,headers=owner,json={'return_date':'2026-09-20'}).status_code==409

@pytest.mark.parametrize('scenario',['overlap','gap','missing','wrong_end'])
def test_invalid_stops_create_nothing(journey_setup,scenario):
    client,owner,other,ids,sessions=journey_setup
    body=payload(ids)
    if scenario=='overlap':body['stops'][1]['arrival_date']='2026-09-15'
    if scenario=='gap':body['stops'][1]['arrival_date']='2026-09-17';body['stops'][1]['departure_date']='2026-09-17'
    if scenario=='missing':body['stops'][1]['destination_id']=str(uuid.uuid4())
    if scenario=='wrong_end':body['return_date']='2026-09-20'
    assert client.post('/api/v1/trips',headers=owner,json=body).status_code in (422,404)
    with sessions() as db:
        assert not db.scalars(select(Trip)).all()
        assert not db.scalars(select(TripDestination)).all()

@pytest.mark.asyncio
async def test_ai_receives_stop_specific_weather_and_timezones(monkeypatch):
    monkeypatch.setattr(planning,'get_settings',lambda:SimpleNamespace(ai_api_key='test-only'))
    class Weather:
        name='test-only'
        async def get_forecast(self,lat,lon,start,days):return [{'date':start.isoformat(),'rain_probability':80 if lon==30 else 10}]
    monkeypatch.setattr(planning,'create_weather_provider',lambda:Weather())
    ids=[uuid.uuid4(),uuid.uuid4()]
    request=PlanningRequest(mode='ai',ai_consent=True,departure_date='2026-09-15',return_date='2026-09-16',stops=[{'destination_id':ids[0],'arrival_date':'2026-09-15','departure_date':'2026-09-15'},{'destination_id':ids[1],'arrival_date':'2026-09-16','departure_date':'2026-09-16'}])
    places=[SimpleNamespace(name='Kigali',country='Rwanda',timezone='Africa/Kigali',latitude=-1,longitude=30),SimpleNamespace(name='Nairobi',country='Kenya',timezone='Africa/Nairobi',latitude=-1,longitude=36)]
    async def ai(context):
        assert [stop['destination']['timezone'] for stop in context['journey']]==['Africa/Kigali','Africa/Nairobi']
        assert context['journey'][0]['available_forecast'][0]['rain_probability']==80
        assert context['journey'][1]['available_forecast'][0]['rain_probability']==10
        return {'itinerary':[{'date':d,'label':'Day','items':[]} for d in context['dates']],'packing':[]}
    monkeypatch.setattr(planning,'call_ai',ai)
    result=await planning.generate_draft(request,places[0],list(zip(request.stops,places)))
    assert len(result['draft']['itinerary'])==2
