from datetime import date, datetime, timezone
import httpx
from fastapi import HTTPException
from app.core.cache import cache
from app.core.config import get_settings
from app.providers.base import WeatherProvider


def condition(code):
    if code == 0: return 'Clear sky', 'sun'
    if code in (1, 2, 3): return 'Partly cloudy' if code < 3 else 'Overcast', 'partly_cloudy'
    if code in (45, 48): return 'Fog', 'cloud'
    if code in (71, 73, 75, 77, 85, 86): return 'Snow', 'cloud'
    if code in (95, 96, 99): return 'Thunderstorms', 'rain'
    return 'Rain or showers', 'rain'

class OpenMeteoProvider(WeatherProvider):
    name = 'open_meteo'
    async def payload(self, latitude, longitude):
        key = f'openmeteo:v1:{latitude:.4f}:{longitude:.4f}'
        cached = await cache.get(key)
        if cached: return cached
        settings = get_settings()
        params = {'latitude': latitude, 'longitude': longitude, 'timezone': 'auto', 'forecast_days': 16,
            'current': 'temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m',
            'hourly': 'temperature_2m,relative_humidity_2m,apparent_temperature,precipitation_probability,weather_code,wind_speed_10m,visibility,uv_index',
            'daily': 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max,uv_index_max'}
        if settings.weather_api_key: params['apikey'] = settings.weather_api_key
        try:
            async with httpx.AsyncClient(timeout=20) as client:
                response = await client.get(settings.open_meteo_url, params=params)
                response.raise_for_status(); data = response.json()
            if not all(k in data for k in ('current', 'hourly', 'daily')): raise ValueError('Incomplete response')
        except (httpx.HTTPError, ValueError) as exc:
            raise HTTPException(503, 'Live weather is temporarily unavailable. Your saved trip is still accessible.') from exc
        data['retrieved_at'] = datetime.now(timezone.utc).isoformat()
        await cache.set(key, data, 600)
        return data

    async def get_current_weather(self, latitude, longitude):
        data = await self.payload(latitude, longitude); c = data['current']; h = data['hourly']
        hour = c['time'][:13] + ':00'; i = h['time'].index(hour) if hour in h['time'] else 0
        text, icon = condition(c['weather_code'])
        return {'temperature': c['temperature_2m'], 'feels_like': c['apparent_temperature'], 'condition': text, 'icon': icon, 'humidity': c['relative_humidity_2m'], 'wind': c['wind_speed_10m'], 'visibility': (h['visibility'][i] or 0)/1000, 'uv': h['uv_index'][i], 'precipitation': h['precipitation_probability'][i], 'observed_at': c['time'], 'timezone': data['timezone'], 'retrieved_at': data['retrieved_at'], 'source': 'Open-Meteo', 'data_kind': 'Live model-based conditions (not a local station observation)'}

    async def get_forecast(self, latitude, longitude, start_date: date, days=7):
        data = await self.payload(latitude, longitude); d = data['daily']; h = data['hourly']; result = []
        for i, when in enumerate(d['time']):
            target = date.fromisoformat(when)
            if not 0 <= (target - start_date).days < days: continue
            hours = [j for j,t in enumerate(h['time']) if t.startswith(when)]
            average = lambda name, fallback: round(sum(h[name][j] or fallback for j in hours)/len(hours), 1) if hours else fallback
            text, icon = condition(d['weather_code'][i])
            result.append({'date': when, 'day': target.strftime('%a').upper(), 'high': d['temperature_2m_max'][i], 'low': d['temperature_2m_min'][i], 'rain_probability': d['precipitation_probability_max'][i], 'condition': text, 'icon': icon, 'humidity': average('relative_humidity_2m', 50), 'wind': d['wind_speed_10m_max'][i], 'visibility': average('visibility', 10000)/1000, 'uv': d['uv_index_max'][i]})
        return result

    async def get_hourly_forecast(self, latitude, longitude, target_date: date):
        data = await self.payload(latitude, longitude); h = data['hourly']; result = []
        for i, when in enumerate(h['time']):
            if not when.startswith(target_date.isoformat()): continue
            result.append({'time': when[11:16], 'temperature': h['temperature_2m'][i], 'feels_like': h['apparent_temperature'][i], 'precipitation': h['precipitation_probability'][i], 'wind': h['wind_speed_10m'][i], 'uv': h['uv_index'][i], 'icon': condition(h['weather_code'][i])[1]})
        return result

    async def get_weather_alerts(self, latitude, longitude):
        return []  # This provider does not provide official severe-weather alerts.
