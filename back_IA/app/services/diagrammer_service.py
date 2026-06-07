import json
import re
from typing import Optional, Any
from app.core.config import get_client, Config
from app.schemas.diagram import DiagramState
from app.core.example_loader import load_json_examples


class DiagrammerService:
    """Servicio para interactuar con la IA de Groq y generar comandos."""

    def __init__(self):
        self.client = get_client()
        self.system_prompt = """
        Eres un Arquitecto de Software experto en Diagramas de Actividad UML 2.5 con Carriles (Swimlanes).
        Tu tarea es gestionar el estado COMPLETO del diagrama a través de comandos JSON precisos.
        
        CONCEPTOS CLAVE:
        - LANES (Carriles): Contenedores verticales. Todo nodo debe estar idealmente dentro de un carril, si es que te lo pedi, si es necesario que este dentro.
        - NODOS: initial (círculo), activity (rectángulo), decision (rombo), final (círculo doble), fork/join (barras).
        - CONEXIONES: Flechas que unen nodos. Pueden tener etiquetas (labels).
        
        COMANDOS PERMITIDOS (Responde SOLO con un array JSON):
        1. CREATE_LANE: { "action": "CREATE_LANE", "name": "Nombre", "orientation": "vertical|horizontal", "x": 0, "y": 0, "width": 200, "height": 600 }
        2. CREATE_NODE: { "action": "CREATE_NODE", "type": "activity|decision|initial|final|fork|join", "name": "Texto", "laneId": "id", "x": 50, "y": 50 }
        3. CREATE_FORM: { "action": "CREATE_FORM", "name": "Nombre Formulario", "laneId": "id", "x": 50, "y": 50, "fields": [{"label": "Nombre", "type": "text", "required": true}] }
        4. ADD_FIELD: { "action": "ADD_FIELD", "nodeId": "id", "field": {"label": "Email", "type": "email", "required": true} }
        5. SET_FORM: { "action": "SET_FORM", "nodeId": "id", "fields": [{"label": "C1", "type": "text"}, {"label": "C2", "type": "number"}] }
        6. CONNECT: { "action": "CONNECT", "from": "id1", "to": "id2", "label": "opcional", "fromPort": "top|bottom|left|right", "toPort": "top|bottom|left|right" }
        7. MOVE: { "action": "MOVE", "id": "id", "x": 100, "y": 100 }
        8. UPDATE_PROP: { "action": "UPDATE_PROP", "id": "id", "props": { "name": "Texto", "fill": "#RRGGBB", "stroke": "#RRGGBB", "strokeWidth": 2, "fontSize": 14, "textColor": "#RRGGBB" } }
        9. DELETE: { "action": "DELETE", "id": "id" }
        
        REGLAS DE POSICIONAMIENTO:
        - Si un nodo pertenece a un carril (laneId), sus coordenadas (x, y) DEBEN estar dentro del área de ese carril.
        - Ejemplo (Carril Vertical): Si el carril está en x=100 con ancho=200, los nodos dentro deben tener x entre 120 y 280.
        - Si el flujo requiere varios actores, CREA un carril para cada uno. El segundo carril debe empezar donde termina el primero (ej: Lane1 x=100, width=300 -> Lane2 x=400).
        - NUNCA posiciones una actividad fuera de los límites laterales de su carril.
        - Para flujos verticales, incrementa la 'y' en al menos 150px por cada paso para que no se amontonen.
        
        REGLAS DE CONEXIÓN:
        - Distribuye las flechas en distintos puertos (top, bottom, left, right) para evitar superposiciones. NUNCA saques dos flechas del mismo puerto en un mismo nodo.
        - Para flujos verticales, prefiere de 'bottom' a 'top'.
        - Para nodos de decisión con múltiples salidas, usa 'left', 'right' o 'bottom' de forma distribuida.
        - SIEMPRE conecta el nodo 'initial' a la primera actividad.
        - SIEMPRE conecta la última actividad o decisión al nodo 'final'.
        - Todos los nodos DEBEN tener un 'name' único para ser referenciados.
        - Para el nodo 'initial', usa siempre el name: "Inicio".
        - Para el nodo 'final', usa siempre el name: "Fin".
        - Usa estos nombres ("Inicio", "Fin", "Nombre de Actividad") en el campo 'from' y 'to' del comando CONNECT.
        
        REGLAS DE FORMULARIOS:
        - Si el usuario pide agregar un formulario a una actividad EXISTENTE, utiliza SET_FORM o ADD_FIELD sobre el 'nodeId' correspondiente. NO crees un nodo nuevo si ya existe uno con ese nombre.
        - Si el nodo implica recolectar datos (ej: "Registrar", "Llenar Solicitud", "Ingresar Datos"), usa CREATE_FORM en lugar de CREATE_NODE.
        - Sugiere automáticamente campos relevantes basados en el nombre del nodo. 
          Ejemplo: Si el nodo es "Pago", agrega campos como "Monto", "Fecha", "Método".
        - Los formularios SIEMPRE llevan: actionType: "form", stroke: "#10b981" (verde) y strokeWidth: 4.
        
        DETALLES TÉCNICOS:
        - Mantén una separación visual coherente (mínimo 150px entre nodos).
        - RESPONDE EXCLUSIVAMENTE CON EL ARRAY JSON.
        """

    async def generate_commands(
        self, prompt: str, state: Optional[DiagramState] = None
    ) -> Any:
        """
        Genera comandos JSON para modificar el diagrama según el prompt.
        """
        if not self.client:
            return {"error": "Cliente de Groq no inicializado."}

        current_state_str = "Vacio"
        if state and state.cells:
            current_state_str = json.dumps([c for c in state.cells], indent=2)

        full_prompt = f"""
        {self.system_prompt}
        
        EJEMPLOS REALES DEL SISTEMA (Formato JSON esperado):
        {load_json_examples()}
        
        ESTADO ACTUAL DEL DIAGRAMA:
        {current_state_str}
        
        REQUERIMIENTO DEL USUARIO:
        {prompt}
        """

        try:
            # Llamada a la API de Groq
            completion = self.client.chat.completions.create(
                model=Config.GROQ_MODEL,
                messages=[{"role": "user", "content": full_prompt}],
                temperature=0.2,
                max_completion_tokens=8000,
                top_p=1,
                stream=False,
                stop=None,
                compound_custom={
                    "tools": {
                        "enabled_tools": ["web_search", "code_interpreter", "visit_website"]
                    }
                }
            )

            text = completion.choices[0].message.content or ""
            text = text.strip()

            # Extracción robusta de JSON
            json_match = re.search(r"```json\s*([\s\S]*?)\s*```", text)
            if not json_match:
                json_match = re.search(r"(\[[\s\S]*\]|\{[\s\S]*\})", text)

            clean_json = json_match.group(1) if json_match else text

            try:
                return json.loads(clean_json)
            except json.JSONDecodeError:
                return text

        except Exception as error:
            print(f"Error en Groq: {error}")
            return {"error": f"Error al procesar comandos: {str(error)}"}
