from fastapi.testclient import TestClient
from app.main import app

def test_health_and_demo_analysis():
    with TestClient(app) as client:
        health = client.get('/health')
        assert health.status_code == 200
        assert health.json()['data']['status'] == 'healthy'
        analysis = client.get('/api/v1/trips/demo/analysis')
        assert analysis.status_code == 401

def test_destination_search():
    with TestClient(app) as client:
        response = client.get('/api/v1/destinations/search?q=kigali')
        assert response.status_code == 200
        assert response.json()['data'][0]['country'] == 'Rwanda'
