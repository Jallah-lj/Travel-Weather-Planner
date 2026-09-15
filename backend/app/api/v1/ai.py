from app.core.auth import current_user
from app.models.entities import User
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.api.v1.trips import get_analysis, intelligence
from app.core.database import get_db
from app.core.responses import success
from app.schemas.trip import AIChatRequest

router = APIRouter(prefix="/ai", tags=["ai-assistant"])

@router.post("/chat")
async def travel_chat(payload: AIChatRequest, db: Session = Depends(get_db), user: User = Depends(current_user)):
    analysis = await get_analysis(payload.trip_id, db, user)
    response = await intelligence.answer_question(analysis, payload.message)
    response['answer'] = f"For the first stop, {analysis['destination']['name']}: " + response['answer']
    return success(response, {"grounded": True, "weather_provider": intelligence.provider.name})

from app.core.config import get_settings
from app.models.entities import Destination
from app.schemas.planning import PlanningRequest
from app.services.planning import generate_draft
from app.services.journey import requested_stops
from fastapi import HTTPException

@router.get('/planning-options')
def planning_options(user: User = Depends(current_user)):
    settings = get_settings()
    return success({'ai_available': bool(settings.ai_api_key), 'provider': ('Gemini' if settings.ai_provider == 'gemini' else 'OpenAI-compatible provider') if settings.ai_api_key else None, 'max_assisted_days':14})

@router.post('/plan-draft')
async def plan_draft(payload: PlanningRequest, db: Session = Depends(get_db), user: User = Depends(current_user)):
    resolved = requested_stops(payload, db)
    return success(await generate_draft(payload, resolved[0][1], resolved))
