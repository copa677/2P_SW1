from typing import Optional, List, Any
from app.core.config import get_client, Config


class AgentService:
    """Servicio del asistente interactivo para guiar al usuario."""

    def __init__(self):
        self.client = get_client()
        self.system_prompt = """
        Eres el "Agente Guía" de una herramienta profesional de diagramación UML 2.5 llamada "UML Activity Diagrammer".
        Tu misión es actuar como un manual interactivo y tutor para los usuarios.
        
        Tus responsabilidades incluyen:
        1. Explicar qué es un diagrama de actividad y sus componentes (Nodos, Decisiones, Carriles/Swimlanes).
        2. Enseñar a usar la herramienta: paneo con click derecho, zoom con ctrl+scroll, arrastrar elementos desde la barra de herramientas.
        3. Resolver dudas sobre el estándar UML 2.5.
        4. Ser amable, pedagógico y conciso.
        
        REGLA: Responde siempre en español. Usa Markdown para dar formato a tus respuestas (negritas, listas, etc.).
        Si el usuario te pide crear algo técnico, recuérdale que puede usar los comandos de voz/texto del constructor, pero tú estás aquí para explicarle el "cómo" y el "por qué".
        """

    async def chat(self, message: str, history: Optional[List[dict]] = None) -> str:
        """
        Procesa un mensaje de chat y retorna la respuesta del asistente.
        """
        if not self.client:
            return "Error: Cliente de Groq no inicializado."

        try:
            # Construimos el historial de mensajes para Groq
            messages = [{"role": "system", "content": self.system_prompt}]
            
            if history:
                for h in history:
                    # Adaptar el formato de historial si es necesario
                    messages.append({
                        "role": h.get("role", "user"),
                        "content": h.get("content", "") or h.get("parts", [""])[0]
                    })
            
            messages.append({"role": "user", "content": message})

            # Llamada a Groq
            completion = self.client.chat.completions.create(
                model=Config.GROQ_MODEL,
                messages=messages,
                temperature=0.7,
                max_completion_tokens=1024
            )
            
            return completion.choices[0].message.content or ""

        except Exception as error:
            print(f"Error en Agent Chat (Groq): {error}")
            return f"Error al procesar el chat: {str(error)}"

    async def chat_diagram(self, message: str, state: Any, history: Optional[List[dict]] = None) -> dict:
        """
        Procesa un mensaje del chat interactivo y actualiza el estado del diagrama.
        Retorna un dict con "response" y "diagram".
        """
        import json
        if not self.client:
            return {
                "response": "Error: Cliente de Groq no inicializado.",
                "diagram": state.dict() if hasattr(state, "dict") else state
            }

        # Serializamos el estado actual
        current_state_dict = state.dict() if hasattr(state, "dict") else state
        current_state_str = json.dumps(current_state_dict, indent=2, ensure_ascii=False)

        system_prompt = """
        Eres un Ingeniero de Requisitos y Arquitecto de Software experto en Diagramas de Actividad UML 2.5 con Carriles (Swimlanes/Calles) y Formularios Dinámicos.
        Tu labor es chatear en español con el usuario y actuar como un agente capaz de construir y modificar el diagrama de actividades según sus instrucciones de voz o texto.

        Puedes realizar las siguientes acciones en el diagrama:
        1. CREAR, ELIMINAR O MOVER ELEMENTOS (start, activity, decision, end, fork, join).
        2. CREAR, ELIMINAR O REDIMENSIONAR CALLES (lane-h, lane-v).
        3. CREAR FORMULARIOS dentro de un nodo de tipo "activity" específico (agregando campos al arreglo "formulario").
        4. CONECTAR ELEMENTOS (crear o eliminar enlaces/flechas en la lista "enlaces").

        FORMATO DE RESPUESTA REQUERIDO (JSON):
        Debes retornar estrictamente un objeto JSON con dos llaves:
        {
          "response": "Tu explicación en español en formato Markdown de los cambios realizados de forma breve y cordial.",
          "diagram": {
             "elementos": [ ... ],
             "enlaces": [ ... ],
             "calles": [ ... ]
          }
        }

        REGLAS DE MODIFICACIÓN DEL DIAGRAMA:
        1. PRESERVACIÓN DE IDs: Conserva de forma estricta los IDs de los elementos (nodos, enlaces, calles) existentes. No los vuelvas a generar para elementos que permanecen en el lienzo. Solo genera nuevos IDs (UUIDv4) para celdas totalmente nuevas.
        2. ASOCIACIÓN DE CALLES: Si colocas un nodo dentro de una calle, setea "calleId" del nodo al ID de esa calle, y añade el ID del nodo al arreglo "elementosContenidos" de esa calle.
        3. COORDENADAS COHERENTES: Las coordenadas (x, y) de los elementos deben estar físicamente dentro de los límites de su calle/carril:
           - Por ejemplo, si una calle vertical tiene posicion x=100, y=80 y tamaño width=220, height=500, los nodos de esa calle deben estar entre x=[120, 280] e y=[100, 540].
           - Separa los nodos en el eje Y por al menos 100px para que no se superpongan y el flujo sea legible.
        4. ELIMINACIÓN: Si eliminas un nodo, quita todas sus referencias en "elementosContenidos" de la calle y elimina cualquier enlace ("enlaces") que tenga a este nodo como origen o destino.
        5. FORMULARIOS: Si el usuario te pide crear un formulario en una actividad, agrega campos al arreglo "formulario" del nodo. Cada campo tiene la estructura:
           - "id": string único del campo (ej: "field_28ad2a").
           - "name": nombre o etiqueta del campo (ej: "Monto Solicitado").
           - "type": uno de "text", "number", "date", "checkbox", "select", "file", "table", "label", "list".
           - "required": boolean (true/false).
           - "options": opcional (ej: para tipo select, opciones separadas por comas "Aceptado,Rechazado").
        6. CONEXIONES (ENLACES): Cada conexión direccional (flecha) en el listado "enlaces" debe tener la siguiente estructura:
           - "id": UUID v4 único para el enlace.
           - "origen": {"elementoId": "id_nodo_origen", "puertoId": "top|bottom|left|right|p1|p2|p3|p4|p5"} (usa "bottom" o "right" para salir).
           - "destino": {"elementoId": "id_nodo_destino", "puertoId": "top|bottom|left|right|p1|p2|p3|p4|p5"} (usa "top" o "left" para entrar).
           - "condicion": string opcional (ej: para salidas de una decisión, ej: "SI", "NO").
           - "vertices": siempre un array vacío [].
           *Cuando el usuario te pida conectar dos nodos, busca sus nombres en el diagrama actual, localiza sus IDs respectivos y añade la conexión al arreglo "enlaces".*
        """

        messages = [
            {"role": "system", "content": system_prompt}
        ]

        if history:
            for h in history:
                messages.append({
                    "role": h.get("role", "user"),
                    "content": h.get("content", "") or h.get("parts", [""])[0]
                })

        user_content = f"""
        ESTADO ACTUAL DEL DIAGRAMA:
        {current_state_str}

        SOLICITUD DEL USUARIO:
        {message}

        Responde en formato JSON con las llaves "response" y "diagram" conteniendo el diagrama actualizado completo.
        """
        messages.append({"role": "user", "content": user_content})

        try:
            completion = self.client.chat.completions.create(
                model=Config.GROQ_MODEL,
                messages=messages,
                temperature=0.2,
                max_completion_tokens=4096,
                response_format={"type": "json_object"}
            )
            
            raw_content = completion.choices[0].message.content or ""
            return json.loads(raw_content)

        except Exception as error:
            print(f"Error en Agent Diagram Chat: {error}")
            return {
                "response": f"Lo siento, ocurrió un error al procesar el diagrama: {str(error)}",
                "diagram": current_state_dict
            }
