from fastapi import APIRouter, HTTPException
from .service import DiagrammerService, DiagramState
from pydantic import BaseModel
from typing import Optional

router = APIRouter(prefix="/diagrammer", tags=["Diagrammer"])
service = DiagrammerService()

class AIRequest(BaseModel):
    prompt: str
    state: Optional[DiagramState] = None

@router.post("/generate")
async def generate(request: AIRequest):
    print(f"DEBUG: Petición recibida con prompt: {request.prompt}")
    result = await service.generate_commands(request.prompt, request.state)
    print(f"DEBUG: Respuesta de IA generada: {result}")
    if isinstance(result, dict) and "error" in result:
        raise HTTPException(status_code=500, detail=result["error"])
    return {"commands": result}
