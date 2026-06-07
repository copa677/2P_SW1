from fastapi import APIRouter, HTTPException
from app.services.diagrammer_service import DiagrammerService
from app.schemas.diagram import AIRequest

router = APIRouter()
service = DiagrammerService()


@router.post("/generate")
async def generate(request: AIRequest):
    """Endpoint para generar comandos de diagramación mediante IA."""
    print(f"DEBUG: Petición recibida con prompt: {request.prompt}")
    result = await service.generate_commands(request.prompt, request.state)
    
    if isinstance(result, dict) and "error" in result:
        raise HTTPException(status_code=500, detail=result["error"])
    
    return {"commands": result}
