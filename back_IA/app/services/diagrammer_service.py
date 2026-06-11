import json
import re
from typing import Optional, Any
from app.core.config import get_client, Config
from app.schemas.diagram import DiagramState


class DiagrammerService:
    """Servicio para interactuar con la IA de Groq y generar/modificar la estructura del diagrama."""

    def __init__(self):
        self.client = get_client()
        self.system_prompt = """
        Eres un Arquitecto de Software y Diseñador de Procesos experto en Diagramas de Actividad UML 2.5 con Carriles (Swimlanes) y Formularios Dinámicos.
        Tu misión es analizar el estado actual del diagrama de actividad y el requerimiento del usuario para devolver el estado ACTUALIZADO completo del diagrama en el formato JSON especificado.

        ESTRUCTURA DEL DIAGRAMA DE ACTIVIDAD (JSON):
        El objeto JSON retornado debe tener tres campos principales en su raíz:

        1. "elementos": Una lista de nodos. Cada nodo contiene:
           - "id": UUID v4 único (ej: "f7223b1f-080b-401d-b59e-03d77f1e01bc").
           - "tipo": "start" (inicio), "activity" (actividad/paso), "decision" (decisión/rombo), "end" (fin), "fork" (bifurcación/barra), "join" (unión/barra).
           - "nombre": Texto visible (ej: "seleccionar producto"). Los tipos "start", "end", "fork" y "join" tienen nombre vacío "".
           - "posicion": {"x": int, "y": int}
           - "tamano": {"width": int, "height": int} (Recomendado: start/end: 30x30, activity/decision: 130x60, fork/join: 8x140 vertical o 140x8 horizontal).
           - "color": Hexadecimal (Recomendado: start: #1e293b, activity: #4f46e5, decision: #fef08a, end: #ffffff).
           - "calleId": ID de la calle/carril donde está contenido.
           - "formulario": Lista de campos para capturar información. Cada campo contiene:
             - "id": ID único de campo (ej: "field_ii4na48").
             - "name": Nombre/etiqueta del campo (ej: "documento").
             - "type": "text", "number", "date", "file" (para documentos), "list" (lista), "table" (tabla).
             - "required": true | false.
             - "options": Opciones de configuración (ej: para tipo "table", las columnas separadas por comas: "producto, cantidad").

        2. "enlaces": Una lista de conexiones direccionales (flechas). Cada enlace contiene:
           - "id": UUID v4 único.
           - "origen": {"elementoId": "id_nodo_origen", "puertoId": "top|bottom|left|right|p1|p2|p3"}
           - "destino": {"elementoId": "id_nodo_destino", "puertoId": "top|bottom|left|right|p1|p2|p3"}
           - "condicion": Etiqueta del enlace/bifurcación (ej: "SI", "NO", "aprobar"). Si no hay condición, dejar vacío "".
           - "vertices": Siempre un array vacío [].

        3. "calles": Una lista de carriles (roles o actores). Cada carril contiene:
           - "id": UUID v4 único (ej: "4f1123da-9264-4388-bb9d-9cf8b9fe7608").
           - "tipo": "lane-v" (carril vertical) o "lane-h" (carril horizontal).
           - "nombre": Rol o actor del carril (ej: "Cliente", "Vendedor", "Aprobador").
           - "posicion": {"x": int, "y": int}
           - "tamano": {"width": int, "height": int}
           - "elementosContenidos": Lista de strings con los IDs de los elementos contenidos en este carril.

        REGLAS DE DISEÑO:
        - Si creas un nodo, asegúrate de asignarle el "calleId" correspondiente y agregarlo a "elementosContenidos" de esa calle.
        - Las coordenadas (x, y) de los elementos deben estar físicamente dentro del rectángulo de su carril.
        - Espacia los nodos verticalmente con al menos 100px a 150px de diferencia en el eje Y para que no se superpongan.
        - Los enlaces deben fluir de forma lógica: preferentemente de "bottom" (origen) a "top" (destino) en flujos verticales.
        - Si una actividad implica ingresar archivos, tablas o números, inicializa la propiedad "formulario" con los campos lógicos pertinentes.

        EJEMPLO DE DIAGRAMA:
        ```json
        {
          "elementos": [
            {
              "id": "e1",
              "tipo": "start",
              "nombre": "",
              "posicion": {"x": 140, "y": 120},
              "tamano": {"width": 30, "height": 30},
              "color": "#1e293b",
              "calleId": "lane-c",
              "formulario": []
            },
            {
              "id": "e2",
              "tipo": "activity",
              "nombre": "solicitar compra",
              "posicion": {"x": 90, "y": 200},
              "tamano": {"width": 130, "height": 60},
              "color": "#4f46e5",
              "calleId": "lane-c",
              "formulario": [
                { "id": "field_1", "name": "documento", "type": "file", "required": true }
              ]
            }
          ],
          "enlaces": [
            {
              "id": "link-1",
              "origen": {"elementoId": "e1", "puertoId": "bottom"},
              "destino": {"elementoId": "e2", "puertoId": "top"},
              "condicion": "",
              "vertices": []
            }
          ],
          "calles": [
            {
              "id": "lane-c",
              "tipo": "lane-v",
              "nombre": "Cliente",
              "posicion": {"x": 70, "y": 80},
              "tamano": {"width": 220, "height": 400},
              "elementosContenidos": ["e1", "e2"]
            }
          ]
        }
        ```

        RESPONDE EXCLUSIVAMENTE CON EL OBJETO JSON ACTUALIZADO. No incluyas explicaciones en lenguaje natural, solo el JSON estructurado.
        """

    async def generate_commands(
        self, prompt: str, state: Optional[DiagramState] = None
    ) -> Any:
        """
        Analiza el estado actual del diagrama y devuelve el nuevo estado JSON completo.
        """
        if not self.client:
            return {"error": "Cliente de Groq no inicializado."}

        # Formatear el estado actual en el prompt
        current_state_str = "{}"
        if state:
            if state.elementos is not None or state.enlaces is not None or state.calles is not None:
                current_state_str = json.dumps({
                    "elementos": state.elementos or [],
                    "enlaces": state.enlaces or [],
                    "calles": state.calles or []
                }, indent=2)
            elif state.cells is not None:
                # Si viene en formato cells, lo enviamos tal cual
                current_state_str = json.dumps(state.cells, indent=2)

        full_prompt = f"""
        {self.system_prompt}
        
        ESTADO ACTUAL DEL DIAGRAMA:
        {current_state_str}
        
        REQUERIMIENTO DEL USUARIO:
        {prompt}
        
        Genera el JSON actualizado completo:
        """

        try:
            # Llamada a la API de Groq
            completion = self.client.chat.completions.create(
                model=Config.GROQ_MODEL,
                messages=[{"role": "user", "content": full_prompt}],
                temperature=0.2,
                max_completion_tokens=6000,
                response_format={"type": "json_object"}
            )

            text = completion.choices[0].message.content or ""
            text = text.strip()

            try:
                return json.loads(text)
            except json.JSONDecodeError:
                # Extracción robusta si no es un JSON limpio
                json_match = re.search(r"(\{[\s\S]*\})", text)
                if json_match:
                    return json.loads(json_match.group(1))
                return {"error": "No se pudo decodificar la respuesta del modelo.", "raw": text}

        except Exception as error:
            print(f"Error en Groq (Diagrammer): {error}")
            return {"error": f"Error al procesar el diagrama: {str(error)}"}
