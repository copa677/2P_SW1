from fastapi import APIRouter, HTTPException
from app.services.analysis_service import AnalysisService
from pydantic import BaseModel
from typing import Optional, List, Any

router = APIRouter()
service = AnalysisService()

class AnalysisRequest(BaseModel):
    state: Any
    history: Optional[List[dict]] = None

@router.post("/analyze")
async def analyze_flow(request: AnalysisRequest):
    """Endpoint para analizar el flujo y detectar fallas o cuellos de botella."""
    result = await service.analyze(request.state, request.history)
    
    if isinstance(result, dict) and "error" in result:
        raise HTTPException(status_code=500, detail=result["error"])
        
    return result
