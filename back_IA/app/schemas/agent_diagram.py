from pydantic import BaseModel
from typing import List, Optional
from app.schemas.diagram import DiagramState

class DiagramChatRequest(BaseModel):
    """Modelo para la solicitud de chat interactivo con modificación de diagrama."""
    message: str
    state: DiagramState
    history: Optional[List[dict]] = None

class DiagramChatResponse(BaseModel):
    """Modelo para la respuesta unificada con mensaje de texto y diagrama actualizado."""
    response: str
    diagram: DiagramState
