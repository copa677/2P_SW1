from fastapi import APIRouter, HTTPException, Response
from app.services.analysis_service import AnalysisService
from app.services.dl_service import DeepLearningService
from app.services.reports_service import ReportsService
from pydantic import BaseModel
from typing import Optional, List, Any

router = APIRouter()
analysis_service = AnalysisService()
dl_service = DeepLearningService()

class AnalysisRequest(BaseModel):
    state: Any
    history: Optional[List[dict]] = None

class DLMetricsRequest(BaseModel):
    logs: List[dict]
    prompt: Optional[str] = None

class TextClassifyRequest(BaseModel):
    texts: List[str]

class TrainRequest(BaseModel):
    logs: List[dict]
    texts_with_labels: Optional[List[dict]] = None

class ReportRequest(BaseModel):
    projectName: str
    logs: List[dict]
    anomaliesSummary: dict

@router.post("/analyze")
async def analyze_flow(request: AnalysisRequest):
    """Endpoint para analizar el flujo y detectar fallas o cuellos de botella."""
    result = await analysis_service.analyze(request.state, request.history)
    
    if isinstance(result, dict) and "error" in result:
        raise HTTPException(status_code=500, detail=result["error"])
        
    return result

@router.post("/dl-kpis")
async def get_dl_kpis(request: DLMetricsRequest):
    """Calcula métricas de anomalías utilizando el Autoencoder de Deep Learning."""
    try:
        logs = request.logs
        explanation = ""
        if request.prompt:
            logs, explanation = await dl_service.filter_logs_by_prompt(request.logs, request.prompt)
        
        anomalies = dl_service.detect_anomalies(logs)
        return {
            "anomalies": anomalies,
            "explanation": explanation
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al calcular anomalías: {str(e)}")

@router.post("/text-classify")
async def classify_texts(request: TextClassifyRequest):
    """Clasifica una lista de comentarios o textos utilizando la red neuronal MLP."""
    try:
        classification = dl_service.classify_texts(request.texts)
        return classification
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al clasificar textos: {str(e)}")

@router.post("/train")
async def train_dl_models(request: TrainRequest):
    """Entrena en caliente los modelos de red neuronal en base a nuevos logs y datos."""
    try:
        metrics = dl_service.train_models(request.logs, request.texts_with_labels)
        return {"status": "trained", "metrics": metrics}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al entrenar los modelos: {str(e)}")

@router.post("/report")
async def generate_report(request: ReportRequest):
    """Genera el reporte dinámico en PDF con los resultados de las anomalías y análisis de IA."""
    try:
        pdf_bytes = ReportsService.generate_pdf_report(
            request.projectName,
            request.logs,
            request.anomaliesSummary
        )
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename=reporte_{request.projectName.replace(' ', '_')}.pdf"
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al generar reporte: {str(e)}")

