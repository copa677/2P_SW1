from fastapi import APIRouter
from app.api.v1.endpoints import diagrammer, agent, analyzer

api_router = APIRouter()

# Unificamos los routers de cada módulo
api_router.include_router(diagrammer.router, prefix="/diagrammer", tags=["Diagrammer"])
api_router.include_router(agent.router, prefix="/agent", tags=["Agent"])
api_router.include_router(analyzer.router, prefix="/analyzer", tags=["Analyzer"])
