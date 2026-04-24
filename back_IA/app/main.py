from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.modules.diagrammer.router import router as diagrammer_router
from app.modules.agent.router import router as agent_router
from app.core.config import Config

app = FastAPI(
    title="UML Activity Agent API",
    description="Backend modular de IA para generación de diagramas y asistencia interactiva.",
    version="1.0.0"
)

# Configurar CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["*"]
)

# Registrar Routers con prefijo de versión
app.include_router(diagrammer_router, prefix="/api/v1")
app.include_router(agent_router, prefix="/api/v1")

@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "gemini_configured": Config.GOOGLE_API_KEY is not None
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=Config.PORT, reload=True)
