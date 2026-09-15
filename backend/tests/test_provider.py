from datetime import date
import pytest
from app.providers.mock import DevelopmentMockWeatherProvider

@pytest.mark.asyncio
async def test_development_provider_is_deterministic():
    provider = DevelopmentMockWeatherProvider()
    first = await provider.get_forecast(-1.94, 30.06, date(2026, 8, 28))
    second = await provider.get_forecast(-1.94, 30.06, date(2026, 8, 28))
    assert first == second
    assert len(first) == 7
    assert provider.name == "development_mock"
