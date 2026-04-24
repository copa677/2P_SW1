from app.core.config import get_client, Config
from pydantic import BaseModel
from typing import List, Optional, Any
import json
import re

class DiagramState(BaseModel):
    cells: List[Any]

class DiagrammerService:
    def __init__(self):
        self.client = get_client()
        self.system_prompt = """
        Eres un Arquitecto de Software experto en Diagramas de Actividad UML 2.5 con Carriles (Swimlanes).
        Tu tarea es gestionar el estado COMPLETO del diagrama a través de comandos JSON precisos.
        
        CONCEPTOS CLAVE:
        - LANES (Carriles): Contenedores verticales. Todo nodo debe estar idealmente dentro de un carril.
        - NODOS: initial (círculo), activity (rectángulo), decision (rombo), final (círculo doble), fork/join (barras).
        - CONEXIONES: Flechas que unen nodos. Pueden tener etiquetas (labels).
        
        COMANDOS PERMITIDOS (Responde SOLO con un array JSON):
        1. CREATE_LANE: { "action": "CREATE_LANE", "name": "Nombre", "orientation": "vertical|horizontal", "x": 0, "y": 0, "width": 200, "height": 600 }
        2. CREATE_NODE: { "action": "CREATE_NODE", "type": "activity|decision|initial|final|fork|join", "name": "Texto", "laneId": "id", "x": 50, "y": 50 }
        3. CONNECT: { "action": "CONNECT", "from": "id1", "to": "id2", "label": "opcional" }
        4. MOVE: { "action": "MOVE", "id": "id", "x": 100, "y": 100 }
        5. UPDATE_PROP: { "action": "UPDATE_PROP", "id": "id", "props": { "name": "Texto", "fill": "#RRGGBB", "stroke": "#RRGGBB", "strokeWidth": 2, "fontSize": 14, "textColor": "#RRGGBB" } }
        6. DELETE: { "action": "DELETE", "id": "id" }
        
        DETALLES TÉCNICOS DE ATRIBUTOS:
        - fill: Color de fondo del nodo.
        - stroke: Color del borde.
        - strokeWidth: Grosor del borde (número).
        - textColor: Color de la letra.
        - fontSize: Tamaño de la letra (número).
        - Si el usuario pide mover un elemento, usa MOVE.
        - Si el usuario pide cambiar el nombre o una propiedad, usa UPDATE_PROP.
        - Para flujos nuevos, genera una secuencia lógica: Lanes -> Nodes -> Connections.
        - Mantén una separación visual coherente (mínimo 100px entre nodos).
        - RESPONDE EXCLUSIVAMENTE CON EL ARRAY JSON. SIN EXPLICACIONES.
        """

    async def generate_commands(self, prompt: str, state: Optional[DiagramState] = None):
        if not self.client:
            return {"error": "Cliente de Gemini no inicializado."}

        # Construir el contexto con el estado actual
        current_state_str = "Vacio"
        if state and state.cells:
            current_state_str = json.dumps([c for c in state.cells], indent=2)

        full_prompt = f"""
        {self.system_prompt}
        
        ESTADO ACTUAL DEL DIAGRAMA:
        {current_state_str}
        
        REQUERIMIENTO DEL USUARIO:
        {prompt}
        """
        
        try:
            # Nueva sintaxis de la SDK google-genai
            response = self.client.models.generate_content(
                model=Config.GEMINI_MODEL,
                contents=full_prompt
            )
            
            # Limpieza robusta de Markdown
            text = response.text.strip()
            clean_json = re.sub(r"^```json\s*|\s*```$", "", text, flags=re.MULTILINE)
            
            return json.loads(clean_json)
        except Exception as e:
            print(f"Error en Gemini (New SDK): {e}")
            return {"error": f"Error al procesar comandos: {str(e)}"}
