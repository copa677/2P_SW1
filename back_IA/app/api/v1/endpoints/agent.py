from fastapi import APIRouter
from app.services.agent_service import AgentService
from app.schemas.agent import ChatRequest
from app.schemas.agent_diagram import DiagramChatRequest, DiagramChatResponse

router = APIRouter()
service = AgentService()


@router.post("/chat")
async def chat(request: ChatRequest):
    """Endpoint para chatear con el asistente de IA."""
    response = await service.chat(request.message, request.history)
    return {"response": response}


@router.post("/diagram-chat", response_model=DiagramChatResponse)
async def diagram_chat(request: DiagramChatRequest):
    """Endpoint para interactuar con el agente y modificar el diagrama."""
    result = await service.chat_diagram(request.message, request.state, request.history)
    return result
