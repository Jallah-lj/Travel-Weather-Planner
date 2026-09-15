from dataclasses import dataclass
from typing import Any

@dataclass(frozen=True)
class ScoreWeights:
    temperature: float = 0.25
    precipitation: float = 0.20
    wind: float = 0.10
    humidity: float = 0.10
    visibility: float = 0.10
    activity: float = 0.25
    def __post_init__(self) -> None:
        if abs(sum(vars(self).values()) - 1.0) > 0.001:
            raise ValueError("Travel score weights must total 1.0")

class TravelScoreEngine:
    """Deterministic planning heuristic; not a scientific or safety rating."""
    def __init__(self, weights: ScoreWeights | None = None) -> None:
        self.weights = weights or ScoreWeights()
    @staticmethod
    def _temperature(value: float) -> int:
        if 19 <= value <= 27: return 100
        return max(0, round(100 - min(abs(value - 23), 23) * 4.2))
    @staticmethod
    def _wind(value: float) -> int:
        return max(0, round(100 - max(0, value - 8) * 2.4))
    @staticmethod
    def _humidity(value: float) -> int:
        return max(0, round(100 - abs(value - 55) * 1.15))
    @staticmethod
    def _visibility(value: float) -> int:
        return min(100, round(value / 10 * 100))
    def calculate(self, weather: dict[str, Any], activity_score: int = 90) -> dict[str, Any]:
        breakdown = {
            "temperature": self._temperature(weather.get("high", weather.get("temperature", 23))),
            "precipitation": max(0, 100 - int(weather.get("rain_probability", weather.get("precipitation", 0)))),
            "wind": self._wind(weather.get("wind", 10)),
            "humidity": self._humidity(weather.get("humidity", 55)),
            "visibility": self._visibility(weather.get("visibility", 10)),
            "activity": activity_score,
        }
        score = round(sum(breakdown[key] * getattr(self.weights, key) for key in breakdown))
        label = "Excellent" if score >= 85 else "Good" if score >= 70 else "Mixed" if score >= 50 else "Challenging"
        return {"score": score, "label": label, "breakdown": breakdown}
