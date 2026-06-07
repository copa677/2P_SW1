from pydantic import BaseModel
from typing import List, Optional, Any


class DiagramState(BaseModel):
    """Modelo Pydantic para validar el estado del diagrama."""
    cells: List[Any]


class AIRequest(BaseModel):
    """Modelo para la solicitud de generación de diagramas."""
    prompt: str
    state: Optional[DiagramState] = None
