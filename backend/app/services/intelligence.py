from datetime import timedelta
from app.services.travel_score import TravelScoreEngine
from app.schemas.destination import DestinationOut

class TravelIntelligenceService:
    def __init__(self, provider, score_engine=None):
        self.provider = provider
        self.score_engine = score_engine or TravelScoreEngine()

    async def analyze_trip(self, trip, destination):
        current = await self.provider.get_current_weather(destination.latitude, destination.longitude)
        forecast = await self.provider.get_forecast(destination.latitude, destination.longitude, trip.departure_date, min(7, (trip.return_date-trip.departure_date).days+1))
        hourly = await self.provider.get_hourly_forecast(destination.latitude, destination.longitude, trip.departure_date)
        for day in forecast:
            score = self.score_engine.calculate(day, 50)
            day.update(score=score['score'], label=score['label'])
        score = round(sum(day['score'] for day in forecast)/len(forecast)) if forecast else None
        return {'trip_id': str(trip.id), 'destination': DestinationOut.model_validate(destination).model_dump(mode='json'), 'date_range': f'{trip.departure_date} – {trip.return_date}', 'current': current, 'forecast': forecast, 'hourly': hourly,
            'summary': {'score': score, 'label': 'Forecast available' if forecast else 'Outside forecast range', 'headline': 'Your destination forecast', 'description': f"Current conditions: {current['condition']} at {current['temperature']} °C. Current weather is not a prediction for future trip dates.", 'recommendation': 'Review each day before scheduling outdoor activities; check official local alerts.', 'confidence': f"{self.provider.name} · data time {current.get('observed_at', 'not supplied')}"},
            'score_breakdown': {}, 'activities': [], 'itinerary': [], 'packing': [],
            'risks': {'level': 'Not assessed', 'title': 'Official alerts are not included', 'detail': 'An absence of alerts here does not establish safety.', 'recommendation': 'Consult the local meteorological authority.', 'factors': []},
            'meta': {'weather_provider': self.provider.name, 'forecast_is_guarantee': False}}

    async def optimize_itinerary(self, trip, forecast):
        # Suggestions never overwrite the user's stored itinerary.
        return []

    async def answer_question(self, analysis, message):
        current = analysis['current']
        return {'answer': f"The current model-based conditions are {current['condition']}, {current['temperature']} °C, wind {current['wind']} km/h. Your trip has {len(analysis['forecast'])} forecast days available. Consult the trip forecast and official local alerts before outdoor activities. This assistant does not make bookings or certify safety.", 'grounded_in': ['current model conditions', 'available trip forecast']}
