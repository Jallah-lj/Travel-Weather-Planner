from datetime import date
import pytest
from app.providers.openmeteo import OpenMeteoProvider
from app.providers.factory import create_weather_provider
from app.core.config import Settings

@pytest.mark.asyncio
async def test_mapping_and_forecast_range(monkeypatch):
    provider = OpenMeteoProvider()
    async def data(*args):
        return {'timezone': 'Africa/Kigali', 'retrieved_at': '2026-09-14T10:00Z', 'current': {'time':'2026-09-14T12:15', 'temperature_2m':24, 'apparent_temperature':25, 'weather_code':0, 'relative_humidity_2m':55,'wind_speed_10m':8}, 'hourly':{'time':['2026-09-14T12:00'], 'temperature_2m':[24], 'apparent_temperature':[25], 'relative_humidity_2m':[55], 'visibility':[12000], 'precipitation_probability':[20], 'uv_index':[5], 'weather_code':[0], 'wind_speed_10m':[8]}, 'daily': {'time':['2026-09-14'], 'weather_code':[0], 'temperature_2m_max':[26], 'temperature_2m_min':[17], 'precipitation_probability_max':[20], 'wind_speed_10m_max':[12], 'uv_index_max':[6]}}
    monkeypatch.setattr(provider, 'payload', data)
    current = await provider.get_current_weather(-1.94,30.06)
    assert current['temperature'] == 24 and current['visibility'] == 12
    assert current['precipitation'] == 20 and current['timezone'] == 'Africa/Kigali'
    assert len(await provider.get_forecast(-1.94,30.06,date(2026,9,14))) == 1
    assert await provider.get_forecast(-1.94,30.06,date(2027,1,1)) == []
    assert await provider.get_hourly_forecast(-1.94,30.06,date(2027,1,1)) == []

def test_no_mock_in_production():
    with pytest.raises(RuntimeError): create_weather_provider(Settings(environment='production', weather_provider='mock'))
    assert create_weather_provider(Settings(weather_provider='openmeteo')).name == 'open_meteo'
