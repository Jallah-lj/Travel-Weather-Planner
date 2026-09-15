from app.services.travel_score import ScoreWeights, TravelScoreEngine

def test_ideal_conditions_score_highly():
    result = TravelScoreEngine().calculate({"temperature": 24, "precipitation": 5, "wind": 10, "humidity": 55, "visibility": 10}, 95)
    assert result["score"] >= 90
    assert result["label"] == "Excellent"

def test_rain_reduces_score():
    engine = TravelScoreEngine()
    dry = engine.calculate({"temperature": 24, "precipitation": 5, "wind": 10, "humidity": 55, "visibility": 10}, 90)
    wet = engine.calculate({"temperature": 24, "precipitation": 90, "wind": 10, "humidity": 55, "visibility": 10}, 90)
    assert wet["score"] < dry["score"]

def test_weights_must_total_one():
    try: ScoreWeights(temperature=.5)
    except ValueError: pass
    else: raise AssertionError("invalid weights should fail")
