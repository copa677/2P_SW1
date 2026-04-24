from fastapi import APIRouter
from .service import AgentService
from pydantic import BaseModel
from typing import List, Optional

router = APIRouter(prefix="/agent", tags=["Agent"])
service = AgentService()

class ChatRequest(BaseModel):
    message: str
    history: Optional[List[dict]] = None

@router.post("/chat")
async def chat(request: ChatRequest):
    response = await service.chat(request.message, request.history)
    return {"response": response}
