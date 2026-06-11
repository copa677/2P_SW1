from pydantic import BaseModel
from typing import List, Optional, Any


class DiagramState(BaseModel):
    """Modelo Pydantic para validar el estado del diagrama."""
    cells: Optional[List[Any]] = None
    elementos: Optional[List[Any]] = None
    enlaces: Optional[List[Any]] = None
    calles: Optional[List[Any]] = None


class AIRequest(BaseModel):
    """Modelo para la solicitud de generación de diagramas."""
    prompt: str
    state: Optional[DiagramState] = None
