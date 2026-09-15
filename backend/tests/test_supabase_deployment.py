"""Supabase protocol fixtures, not live provider/account verification."""
import uuid
from datetime import date
import httpx
import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from app.main import app
from app.core import config
from app.core.config import Settings
from app.core.database import Base, get_db
from app.core.cache import cache
from app.models.entities import User, Trip, Destination, TripDestination
from app.services import supabase_auth

@pytest.fixture
def setup(monkeypatch):
    settings=Settings(_env_file=None, environment='test',auth_provider='supabase',supabase_url='https://auth.example.test',supabase_publishable_key='sb_publishable_fixture')
    monkeypatch.setattr(config,'get_settings',lambda:settings)
    monkeypatch.setattr(supabase_auth,'get_settings',lambda:settings)
    engine=create_engine('sqlite://',connect_args={'check_same_thread':False},poolclass=StaticPool)
    Base.metadata.create_all(engine);sessions=sessionmaker(engine)
    def db():
        with sessions() as session:yield session
    app.dependency_overrides[get_db]=db;cache.memory.clear()
    yield settings,sessions
    app.dependency_overrides.clear();engine.dispose()

def identity(subject,email='owner@example.test'):
    return {'id':str(subject),'email':email,'email_confirmed_at':'2026-09-15T00:00:00Z','user_metadata':{'display_name':'Owner'}}

def test_supabase_owner_isolation_and_legacy_endpoints_disabled(setup,monkeypatch):
    _,sessions=setup;owner,other=uuid.uuid4(),uuid.uuid4()
    def verify(token):
        if token=='owner':return identity(owner)
        if token=='other':return identity(other,'other@example.test')
        raise HTTPException(401,'Invalid session')
    monkeypatch.setattr(supabase_auth,'verified_identity',verify)
    with TestClient(app) as client:
        assert client.post('/api/v1/auth/login',json={'email':'old@example.com','password':'testpassword'}).status_code==410
        assert client.get('/api/v1/trips',headers={'Authorization':'Bearer forged'}).status_code==401
        assert client.get('/api/v1/trips',headers={'Authorization':'Bearer owner'}).status_code==200
        with sessions() as db:
            user=db.scalar(select(User).where(User.supabase_subject==owner));assert user.password_hash=='!supabase-managed'
            trip=Trip(user_id=user.id,title='Private',departure_date=date(2026,9,15),return_date=date(2026,9,15))
            destination=Destination(slug='kigali-test',name='Kigali',country='Rwanda',country_code='RW',flag='🇷🇼',timezone='Africa/Kigali',latitude=-1.9441,longitude=30.0619)
            db.add_all([destination,trip]);db.flush()
            db.add(TripDestination(trip_id=trip.id,destination_id=destination.id,arrival_date=trip.departure_date,departure_date=trip.return_date,position=0))
            db.commit();trip_id=str(trip.id)
        assert len(client.get('/api/v1/trips',headers={'Authorization':'Bearer owner'}).json()['data'])==1
        assert client.get('/api/v1/trips',headers={'Authorization':'Bearer other'}).json()['data']==[]
        assert client.delete('/api/v1/trips/'+trip_id,headers={'Authorization':'Bearer other'}).status_code==404
        with sessions() as db:
            user=db.get(User,owner);user.is_active=False;db.commit()
        assert client.get('/api/v1/trips',headers={'Authorization':'Bearer owner'}).status_code==403

def test_email_match_never_claims_legacy_account(setup,monkeypatch):
    _,sessions=setup
    with sessions() as db:
        db.add(User(email='owner@example.test',password_hash='legacy'));db.commit()
        monkeypatch.setattr(supabase_auth,'verified_identity',lambda token:identity(uuid.uuid4()))
        with pytest.raises(HTTPException) as error:supabase_auth.resolve_user('valid',db)
        assert error.value.status_code==409
        assert db.scalar(select(User)).supabase_subject is None

@pytest.mark.parametrize('status,payload,expected',[(401,{},401),(503,{'secret':'do-not-echo'},503),(200,{'id':'bad'},503),(200,{'id':str(uuid.uuid4()),'email':'unconfirmed@example.test'},403)])
def test_auth_provider_failures_are_closed_and_sanitized(setup,monkeypatch,status,payload,expected):
    original=httpx.Client
    def respond(request):
        assert request.url=='https://auth.example.test/auth/v1/user'
        assert request.headers['Authorization']=='Bearer opaque-token'
        assert request.headers['apikey']=='sb_publishable_fixture'
        return httpx.Response(status,json=payload)
    monkeypatch.setattr(supabase_auth.httpx,'Client',lambda **kwargs:original(transport=httpx.MockTransport(respond),**kwargs))
    with pytest.raises(HTTPException) as error:supabase_auth.verified_identity('opaque-token')
    assert error.value.status_code==expected
    assert 'do-not-echo' not in error.value.detail

def test_verified_provider_identity_is_used(setup,monkeypatch):
    subject=uuid.uuid4();original=httpx.Client
    monkeypatch.setattr(supabase_auth.httpx,'Client',lambda **kwargs:original(transport=httpx.MockTransport(lambda request:httpx.Response(200,json=identity(subject))),**kwargs))
    assert supabase_auth.verified_identity('opaque-not-locally-decoded')['id']==str(subject)

def production(**overrides):
    values=dict(environment='production',auth_provider='supabase',supabase_url='https://realproject.supabase.co',supabase_publishable_key='sb_publishable_fixture',database_url='postgresql+psycopg://travel_app:password@db.example.test/postgres?sslmode=require',redis_url='rediss://host.example.test:6379',secret_key='a'*48,allowed_origins='https://travel.example.test')
    values.update(overrides)
    return Settings(_env_file=None,**values)

@pytest.mark.parametrize('override',[{'auth_provider':'local'},{'database_url':'sqlite:///test.db'},{'redis_url':'redis://localhost:6379'},{'allowed_origins':'*'},{'secret_key':'short'},{'database_url':'postgresql+psycopg://db.example.test/db?sslmode=disable'}])
def test_unsafe_production_config_is_rejected(override):
    with pytest.raises(RuntimeError):production(**override).validate_production()

def test_valid_production_config():production().validate_production()
