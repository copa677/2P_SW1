from pydantic import BaseModel
from typing import List, Optional


class ChatRequest(BaseModel):
    """Modelo para la solicitud de chat con el asistente."""
    message: str
    history: Optional[List[dict]] = None
