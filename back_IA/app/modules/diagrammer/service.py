import json
import re
from typing import List, Optional, Any
from pydantic import BaseModel
from app.core.config import get_client, Config


class DiagramState(BaseModel):
    """Modelo Pydantic para validar el estado del diagrama."""
    cells: List[Any]


class DiagrammerService:
    """Servicio para interactuar con la IA de Groq y generar comandos."""

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

    async def generate_commands(
        self, prompt: str, state: Optional[DiagramState] = None
    ) -> Any:
        """
        Genera comandos JSON para modificar el diagrama según el prompt.
        
        Args:
            prompt (str): La solicitud del usuario.
            state (Optional[DiagramState]): El estado actual del diagrama.
            
        Returns:
            Any: Un objeto JSON parseado (lista/dict) o texto plano si es una sugerencia.
        """
        if not self.client:
            return {"error": "Cliente de Groq no inicializado."}

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
            # Llamada a la API de Groq según el formato requerido
            completion = self.client.chat.completions.create(
                model=Config.GROQ_MODEL,
                messages=[
                    {
                        "role": "user",
                        "content": full_prompt
                    }
                ],
                temperature=0.2,
                max_completion_tokens=8000,
                top_p=1,
                stream=False,
                stop=None,
                compound_custom={
                    "tools": {
                        "enabled_tools": [
                            "web_search",
                            "code_interpreter",
                            "visit_website"
                        ]
                    }
                }
            )

            # Extraer el texto de la respuesta
            text = completion.choices[0].message.content or ""
            text = text.strip()

            # Intentar extraer JSON de bloques de código markdown o entre corchetes
            json_match = re.search(r"```json\s*([\s\S]*?)\s*```", text)
            if not json_match:
                json_match = re.search(r"(\[[\s\S]*\]|\{[\s\S]*\})", text)

            clean_json = json_match.group(1) if json_match else text

            try:
                return json.loads(clean_json)
            except json.JSONDecodeError:
                # Si falla el parseo, devolvemos el texto original (mensaje/sugerencia)
                return text

        except Exception as error:
            print(f"Error en Groq: {error}")
            return {"error": f"Error al procesar comandos: {str(error)}"}
