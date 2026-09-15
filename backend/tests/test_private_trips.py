import uuid
from datetime import date, timedelta
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.main import app
from app.core.database import Base, get_db
from app.core.cache import cache
from app.models.entities import Destination


def test_private_ownership_and_durable_plan(tmp_path):
    engine = create_engine(f'sqlite:///{tmp_path}/private.db', connect_args={'check_same_thread': False})
    Base.metadata.create_all(engine)
    sessions = sessionmaker(engine)
    def db_override():
        with sessions() as db: yield db
    app.dependency_overrides[get_db] = db_override
    cache.memory.clear()
    destination_id = uuid.uuid4()
    with sessions() as db:
        db.add(Destination(id=destination_id, slug='kigali', name='Kigali', country='Rwanda', country_code='RW', flag='🇷🇼', latitude=-1.9441, longitude=30.0619, timezone='Africa/Kigali')); db.commit()
    try:
        with TestClient(app) as client:
            def account(email):
                result = client.post('/api/v1/auth/register', json={'email': email, 'password': 'Private-trip-password42', 'display_name': 'Test traveler'})
                assert result.status_code == 201, result.text
                return {'Authorization': f"Bearer {result.json()['data']['access_token']}"}
            a = account('a@example.com'); b = account('b@example.com')
            assert client.get('/api/v1/trips').status_code == 401
            assert client.get('/api/v1/trips', headers=b).json()['data'] == []
            start = date.today(); end = start + timedelta(days=2)
            response = client.post('/api/v1/trips', headers=a, json={'destination_id': str(destination_id), 'departure_date': str(start), 'return_date': str(end)})
            assert response.status_code == 201, response.text
            trip_id = response.json()['data']['id']; path = f'/api/v1/trips/{trip_id}'
            for suffix in ['', '/plan', '/analysis', '/weather', '/activities', '/packing']:
                assert client.get(path+suffix, headers=b).status_code == 404
                assert client.get(path+suffix).status_code == 401
            assert client.delete(path, headers=b).status_code == 404
            assert client.put(path, headers=b, json={'travel_style':'family'}).status_code == 404
            assert client.post(path+'/optimize', headers=b).status_code == 404
            assert client.post('/api/v1/ai/chat', headers=b, json={'trip_id': trip_id, 'message': 'My plans?'}).status_code == 404
            assert client.get('/api/v1/trips/demo/analysis', headers=a).status_code == 404
            plan = client.get(path+'/plan', headers=a).json()['data']
            plan['itinerary'][0]['items'] = [{'id':'visit-1','time':'10:30','title':'Visit a museum','category':'indoor'}]
            plan['packing'][0]['packed'] = True; plan['packing'][0]['quantity'] = 2
            payload = {k: plan[k] for k in ['itinerary','packing','revision']}
            assert client.put(path+'/plan', headers=b, json=payload).status_code == 404
            saved = client.put(path+'/plan', headers=a, json=payload)
            assert saved.status_code == 200, saved.text
            assert client.put(path+'/plan', headers=a, json=payload).status_code == 409
            cache.memory.clear()
            reloaded = client.get(path+'/plan', headers=a).json()['data']
            assert reloaded['itinerary'][0]['items'][0]['title'] == 'Visit a museum'
            assert reloaded['packing'][0]['packed'] is True
            assert reloaded['packing'][0]['quantity'] == 2
            # Database record, not an HTTP or application-cache artifact.
            from app.models.entities import TripPlan
            with sessions() as db:
                assert db.get(TripPlan, uuid.UUID(trip_id)).itinerary[0]['items'][0]['time'] == '10:30'
            payload['revision'] = reloaded['revision']; payload['packing'][0]['quantity'] = -1
            assert client.put(path+'/plan', headers=a, json=payload).status_code == 422
            assert len(client.get('/api/v1/trips', headers=a).json()['data']) == 1
            assert client.get('/api/v1/trips', headers=b).json()['data'] == []
    finally:
        app.dependency_overrides.clear(); engine.dispose()
