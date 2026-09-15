import json
import uuid
from types import SimpleNamespace
import httpx
import pytest
from fastapi.testclient import TestClient
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.main import app
from app.core.database import Base,get_db
from app.core.cache import cache
from app.models.entities import Destination
from app.api.v1 import routing
from app.services import google_maps
from app.services.schedule import check_schedule


def item(id,time,duration=None,place=True):
    return {'id':id,'title':id,'time':time,'duration_minutes':duration,'location':{'provider':'google','place_id':'place-'+id} if place else None,'category':'custom'}

def test_schedule_overlap_travel_gaps_and_missing_data():
    data=[item('a','09:00',60),item('b','10:10',45)]
    result=check_schedule(data,[{'duration_seconds':1200}],10)
    assert result['status']=='conflicts'
    assert result['segments'][0]['shortage_minutes']==20
    assert check_schedule(data)['status']=='incomplete'
    data[1]['time']='11:00'
    assert check_schedule(data,[{'duration_seconds':1200}],10)['status']=='no_conflicts_detected'
    assert check_schedule([item('a','23:30',90),item('b','09:00',None,False)])['status']=='conflicts'
    issues=check_schedule([item('a','09:00',180),item('b','10:00',30),item('c','11:00',30)])['issues']
    assert len([issue for issue in issues if issue['code']=='overlap'])==2
    assert check_schedule([])['status']=='incomplete'

@pytest.fixture
def setup(tmp_path,monkeypatch):
    engine=create_engine(f'sqlite:///{tmp_path}/routes.db',connect_args={'check_same_thread':False});Base.metadata.create_all(engine);sessions=sessionmaker(engine)
    def db():
        with sessions() as session:yield session
    app.dependency_overrides[get_db]=db;cache.memory.clear()
    settings=SimpleNamespace(environment='test',google_maps_legal_approved=False,google_maps_server_key='routing-key',google_maps_browser_key='browser-public-key',google_routes_per_user_minute=2,google_routes_per_user_day=10,google_routes_per_day=20,google_places_per_user_minute=10,google_places_per_user_day=30,google_places_per_day=100)
    monkeypatch.setattr(routing,'get_settings',lambda:settings)
    with sessions() as session:
        destination=Destination(slug='kigali',name='Kigali',country='Rwanda',country_code='RW',flag='🇷🇼',latitude=-1.9441,longitude=30.0619,timezone='Africa/Kigali');session.add(destination);session.commit();dest=str(destination.id)
    with TestClient(app) as client:
        def account(name):return {'Authorization':'Bearer '+client.post('/api/v1/auth/register',json={'email':name+'@example.com','display_name':name,'password':'Routing-password-test42'}).json()['data']['access_token']}
        owner=account('owner');other=account('other')
        result=client.post('/api/v1/trips',headers=owner,json={'destination_id':dest,'departure_date':'2026-09-15','return_date':'2026-09-15','initial_plan':{'itinerary':[{'date':'2026-09-15','label':'Tuesday','travel_mode':'DRIVE','items':[item('a','09:00',60),item('b','10:10',45)]}],'packing':[]}})
        assert result.status_code==201,result.text
        yield client,owner,other,'/api/v1/trips/'+result.json()['data']['id'],settings
    app.dependency_overrides.clear();engine.dispose()

def test_private_routes_fields_quotas_and_no_key_reuse(setup,monkeypatch):
    client,owner,other,path,settings=setup
    calls=[]
    class Provider:
        async def route(self,items,mode):
            calls.append((items,mode));return {'distance_meters':5000,'duration_seconds':1200,'polyline':'test-fixture','warnings':[],'legs':[{'duration_seconds':1200,'distance_meters':5000,'start':{'latitude':-1.94,'longitude':30.06},'end':{'latitude':-1.95,'longitude':30.07}}]}
    monkeypatch.setattr(routing,'GoogleMapsProvider',Provider)
    payload={'revision':1,'day_date':'2026-09-15','buffer_minutes':10}
    assert client.post(path+'/route',json=payload).status_code==401
    assert client.post(path+'/route',headers=other,json=payload).status_code==404
    response=client.post(path+'/route',headers=owner,json=payload)
    assert response.status_code==200,response.text
    assert response.headers['cache-control']=='no-store'
    assert response.json()['data']['schedule']['status']=='conflicts'
    assert calls[0][1]=='DRIVE'
    assert len(calls[0][0])==2
    assert client.post(path+'/route',headers=owner,json={**payload,'revision':2}).status_code==409
    assert client.post(path+'/route',headers=owner,json=payload).status_code==200
    assert client.post(path+'/route',headers=owner,json=payload).status_code==429
    assert len(calls)==2
    config=client.get('/api/v1/routing/config',headers=owner).json()['data']
    assert config['browser_key']=='browser-public-key'
    assert 'routing-key' not in json.dumps(config)
    settings.google_maps_server_key=''
    assert client.post(path+'/route',headers=owner,json=payload).status_code==503
    assert client.post(path+'/schedule',headers=owner,json=payload).status_code==200

def test_only_place_ids_persist_and_missing_locations_are_not_skipped(setup):
    client,owner,other,path,settings=setup
    plan=client.get(path+'/plan',headers=owner).json()['data']
    assert plan['itinerary'][0]['items'][0]['location']=={'provider':'google','place_id':'place-a'}
    plan['itinerary'][0]['items'][0]['location']=None
    assert client.put(path+'/plan',headers=owner,json=plan).status_code==200
    assert client.post(path+'/route',headers=owner,json={'revision':2,'day_date':'2026-09-15'}).status_code==422
    plan['revision']=2;plan['itinerary'][0]['items'][0]['duration_minutes']=-5
    assert client.put(path+'/plan',headers=owner,json=plan).status_code==422

@pytest.mark.asyncio
async def test_google_native_request_uses_restricted_fields_and_no_secret_url(monkeypatch):
    monkeypatch.setattr(google_maps,'get_settings',lambda:SimpleNamespace(google_maps_server_key='server-secret'))
    real=httpx.AsyncClient
    def handler(request):
        assert request.headers['x-goog-api-key']=='server-secret'
        assert 'server-secret' not in str(request.url)
        assert '*' not in request.headers['x-goog-fieldmask']
        if 'autocomplete' in request.url.path:
            body=json.loads(request.content);assert body['sessionToken']=='session';assert body['locationBias']['circle']['center']['latitude']==-1.94
            return httpx.Response(200,json={'suggestions':[{'placePrediction':{'placeId':'place-a','text':{'text':'Test place'}}}]})
        if 'computeRoutes' in request.url.path:
            body=json.loads(request.content);assert body['routingPreference']=='TRAFFIC_UNAWARE';assert body['origin']['placeId']=='place-a'
            return httpx.Response(200,json={'routes':[{'duration':'600s','distanceMeters':1500,'polyline':{'encodedPolyline':'abc'},'legs':[{'duration':'600s','distanceMeters':1500,'startLocation':{'latLng':{'latitude':1,'longitude':2}},'endLocation':{'latLng':{'latitude':3,'longitude':4}}}]}]})
        return httpx.Response(200,json={'id':'place-a','displayName':{'text':'Test place'},'formattedAddress':'Test address','location':{'latitude':1,'longitude':2},'attributions':[{'provider':'Test source'}]})
    monkeypatch.setattr(google_maps.httpx,'AsyncClient',lambda **kwargs:real(transport=httpx.MockTransport(handler)))
    provider=google_maps.GoogleMapsProvider()
    assert (await provider.search('Test','session',-1.94,30.06))[0]['place_id']=='place-a'
    assert (await provider.details('place-a','session'))['latitude']==1
    assert (await provider.route([item('a','09:00',60),item('b','10:00',60)],'DRIVE'))['duration_seconds']==600

@pytest.mark.asyncio
async def test_provider_failure_has_no_fictional_route_or_leaked_error(monkeypatch):
    monkeypatch.setattr(google_maps,'get_settings',lambda:SimpleNamespace(google_maps_server_key='secret'))
    real=httpx.AsyncClient
    monkeypatch.setattr(google_maps.httpx,'AsyncClient',lambda **kwargs:real(transport=httpx.MockTransport(lambda request:httpx.Response(403,json={'error':{'message':'secret'}}))))
    with pytest.raises(HTTPException) as caught:await google_maps.GoogleMapsProvider().route([item('a','09:00'),item('b','10:00')],'WALK')
    assert caught.value.status_code==503 and 'secret' not in caught.value.detail
