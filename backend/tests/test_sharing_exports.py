import hashlib
import uuid
from datetime import date, datetime, timedelta, timezone
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
from app.main import app
from app.core.database import Base, get_db
from app.core.cache import cache
from app.models.entities import Destination, TripShare

@pytest.fixture
def setup(tmp_path):
    engine = create_engine(f'sqlite:///{tmp_path}/sharing.db', connect_args={'check_same_thread': False})
    Base.metadata.create_all(engine); sessions = sessionmaker(engine)
    def db_override():
        with sessions() as db: yield db
    app.dependency_overrides[get_db] = db_override; cache.memory.clear()
    destination_id = uuid.uuid4()
    with sessions() as db:
        db.add(Destination(id=destination_id, slug='kigali', name='Kigali', country='Rwanda', country_code='RW', flag='🇷🇼', latitude=-1.9441, longitude=30.0619, timezone='Africa/Kigali')); db.commit()
    with TestClient(app) as client:
        def register(label):
            response = client.post('/api/v1/auth/register', json={'email': f'{label}@example.com', 'password': 'Sharing-test-passphrase42', 'display_name': label})
            assert response.status_code == 201
            return {'Authorization': 'Bearer ' + response.json()['data']['access_token']}
        owner = register('owner'); other = register('other')
        trip = client.post('/api/v1/trips', headers=owner, json={'destination_id': str(destination_id), 'departure_date': '2026-09-14', 'return_date': '2026-09-15'}).json()['data']['id']
        yield client, owner, other, '/api/v1/trips/' + trip, sessions
    app.dependency_overrides.clear(); engine.dispose()

def test_share_permissions_expiry_revocation_and_conflicts(setup):
    client, owner, other, path, sessions = setup
    assert client.post(path+'/shares', headers=other, json={}).status_code == 404
    assert client.get(path+'/shares').status_code == 401
    assert client.post(path+'/shares', headers=owner, json={'permission':'admin'}).status_code == 422
    link = client.post(path+'/shares', headers=owner, json={'permission':'view'}).json()['data']
    token = link['token']; grant = {'X-Trip-Share': token}
    assert len(token) == 43
    with sessions() as db:
        row = db.get(TripShare, uuid.UUID(link['id']))
        assert row.token_hash == hashlib.sha256(token.encode()).hexdigest() and row.token_hash != token
    metadata = client.get(path+'/shares', headers=owner).json()['data'][0]
    assert 'token' not in metadata and 'token_hash' not in metadata
    shared = client.get('/api/v1/shared/plan', headers=grant)
    assert shared.status_code == 200 and shared.headers['cache-control'] == 'no-store'
    assert shared.json()['data']['permission'] == 'view'
    assert 'owner@example.com' not in shared.text
    plan = shared.json()['data']['plan']; payload = {k:plan[k] for k in ('revision','itinerary','packing')}
    assert client.put('/api/v1/shared/plan', headers=grant, json=payload).status_code == 403
    assert client.put(path+'/plan', headers=grant, json=payload).status_code == 401
    editor = client.post(path+'/shares', headers=owner, json={'permission':'edit'}).json()['data']
    edit_headers = {'X-Trip-Share':editor['token']}
    payload['itinerary'][0]['items'] = [{'id':'shared-activity', 'time':'10:30', 'title':'Meet at the museum', 'category':'custom'}]
    saved = client.put('/api/v1/shared/plan', headers=edit_headers, json=payload)
    assert saved.status_code == 200
    assert client.put(path+'/plan', headers=owner, json=payload).status_code == 409
    assert client.get(path+'/plan', headers=owner).json()['data']['itinerary'][0]['items'][0]['title'] == 'Meet at the museum'
    assert client.delete(path+'/shares/'+editor['id'], headers=other).status_code == 404
    assert client.delete(path+'/shares/'+editor['id'], headers=owner).status_code == 200
    assert client.get('/api/v1/shared/plan', headers=edit_headers).status_code == 404
    assert client.put('/api/v1/shared/plan', headers=edit_headers, json=payload).status_code == 404
    with sessions() as db:
        row = db.get(TripShare, uuid.UUID(link['id'])); row.expires_at = datetime.now(timezone.utc)-timedelta(seconds=1); db.commit()
    assert client.get('/api/v1/shared/plan', headers=grant).status_code == 404
    assert client.get('/api/v1/shared/plan', headers={'X-Trip-Share':'wrong'}).status_code == 404

def test_calendar_pdf_and_offline_export_are_owned_and_safe(setup):
    client, owner, other, path, sessions = setup
    plan = client.get(path+'/plan', headers=owner).json()['data']
    payload = {k:plan[k] for k in ('revision','itinerary','packing')}
    malicious = 'Café <script>alert(1)</script>; lunch, walk\nNew line'
    payload['itinerary'][0]['items'] = [{'id':'activity-1', 'time':'10:30', 'title':malicious, 'category':'custom'}]
    assert client.put(path+'/plan', headers=owner, json=payload).status_code == 200
    for kind in ['calendar','pdf','offline']:
        assert client.get(path+'/export/'+kind).status_code == 401
        assert client.get(path+'/export/'+kind, headers=other).status_code == 404
    calendar = client.get(path+'/export/calendar', headers=owner)
    assert calendar.status_code == 200
    assert 'DTSTART:20260914T083000Z' in calendar.text  # Kigali UTC+02
    assert 'BEGIN:VTODO' in calendar.text and 'END:VCALENDAR' in calendar.text
    assert '\\;' in calendar.text and '\\,' in calendar.text and '\\n' in calendar.text
    assert all(len(line.encode('utf-8')) <= 75 for line in calendar.text.split('\r\n'))
    pdf = client.get(path+'/export/pdf', headers=owner)
    assert pdf.status_code == 200 and pdf.content.startswith(b'%PDF-')
    assert 'attachment;' in pdf.headers['content-disposition']
    offline = client.get(path+'/export/offline', headers=owner)
    assert offline.status_code == 200
    assert '<script>' not in offline.text and '&lt;script&gt;' in offline.text
    assert 'src=' not in offline.text and 'X-Trip-Share' not in offline.text
    assert 'does not' in offline.text or 'will not' in offline.text
    assert client.get(path+'/export/unknown', headers=owner).status_code == 422


def test_deleted_trip_invalidates_links(setup):
    client, owner, other, path, sessions = setup
    link = client.post(path+'/shares', headers=owner, json={}).json()['data']
    assert client.delete(path, headers=owner).status_code == 200
    assert client.get('/api/v1/shared/plan', headers={'X-Trip-Share':link['token']}).status_code == 404
