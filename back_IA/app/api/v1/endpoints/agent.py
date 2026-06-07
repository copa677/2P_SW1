from fastapi import APIRouter
from app.services.agent_service import AgentService
from app.schemas.agent import ChatRequest

router = APIRouter()
service = AgentService()


@router.post("/chat")
async def chat(request: ChatRequest):
    """Endpoint para chatear con el asistente de IA."""
    response = await service.chat(request.message, request.history)
    return {"response": response}
