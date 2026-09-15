import json
from types import SimpleNamespace
import httpx
import pytest
from fastapi import HTTPException
from app.services import planning

@pytest.fixture
def gemini_settings(monkeypatch):
    monkeypatch.setattr(planning, 'get_settings', lambda: SimpleNamespace(ai_api_key='test-secret-not-real', ai_provider='gemini', ai_model='gemini-3.6-flash', gemini_api_url='https://generativelanguage.googleapis.com/v1beta'))

def mock_client(monkeypatch, handler):
    real_client = httpx.AsyncClient
    monkeypatch.setattr(planning.httpx, 'AsyncClient', lambda **kwargs: real_client(transport=httpx.MockTransport(handler)))

@pytest.mark.asyncio
async def test_native_gemini_transport_uses_secret_header_and_json(gemini_settings, monkeypatch):
    def handler(request):
        assert request.url.path.endswith('/models/gemini-3.6-flash:generateContent')
        assert request.headers['x-goog-api-key'] == 'test-secret-not-real'
        assert 'test-secret-not-real' not in str(request.url)
        body = json.loads(request.content)
        assert body['generationConfig']['responseMimeType'] == 'application/json'
        assert 'systemInstruction' in body
        assert 'email' not in body['contents'][0]['parts'][0]['text']
        return httpx.Response(200, json={'candidates':[{'finishReason':'STOP','content':{'parts':[{'thought':True,'text':'internal'},{'text':'{"itinerary":[],"packing":[]}'}]}}]})
    mock_client(monkeypatch, handler)
    assert await planning.call_ai({'destination':{'name':'Kigali'}}) == {'itinerary':[], 'packing':[]}

@pytest.mark.asyncio
@pytest.mark.parametrize('status', [401,403,404,429,500])
async def test_gemini_errors_never_expose_provider_body(gemini_settings, monkeypatch, status):
    mock_client(monkeypatch, lambda request: httpx.Response(status, json={'error':{'message':'test-secret-not-real'}}))
    with pytest.raises(HTTPException) as failure: await planning.call_ai({})
    assert 'test-secret-not-real' not in failure.value.detail
    assert failure.value.status_code in (502,503)

@pytest.mark.asyncio
async def test_gemini_truncated_output_is_rejected(gemini_settings, monkeypatch):
    mock_client(monkeypatch, lambda request: httpx.Response(200, json={'candidates':[{'finishReason':'MAX_TOKENS','content':{'parts':[{'text':'{"itinerary":[],"packing":[]}'}]}}]}))
    with pytest.raises(HTTPException): await planning.call_ai({})
