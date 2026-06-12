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
                temperature=0.5,
                max_completion_tokens=2048
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

        print("\n📥 [CHAT DIAGRAM - INPUT MESSAGE]:", message)
        print("📥 [CHAT DIAGRAM - INPUT STATE]:")
        print(current_state_str)
        print("--------------------------------------------------")

        system_prompt = """
        Eres un Ingeniero de Requisitos y Arquitecto de Software experto en Diagramas de Actividad UML 2.5 con Carriles (Swimlanes/Calles) y Formularios Dinámicos.
        Tu labor es chatear en español con el usuario y actuar como un agente capaz de construir, modificar y refinar el diagrama de actividades según sus instrucciones de voz o texto, guiándole en el proceso.

        Puedes realizar las siguientes acciones en el diagrama:
        1. CREAR, ELIMINAR O MOVER ELEMENTOS (start, activity, decision, end, fork, join).
        2. CREAR, ELIMINAR O REDIMENSIONAR CALLES (lane-h, lane-v).
        3. CREAR FORMULARIOS dentro de un nodo de tipo "activity" específico (agregando campos al arreglo "formulario").
        4. CONECTAR ELEMENTOS (crear o eliminar enlaces/flechas en la lista "enlaces").

        FORMATO DE RESPUESTA REQUERIDO (JSON):
        Debes retornar estrictamente un objeto JSON con dos llaves:
        {
          "response": "Tu explicación en español en formato Markdown de los cambios realizados o preguntas de aclaración de forma breve y cordial.",
          "diagram": {
             "elementos": [ ... ],
             "enlaces": [ ... ],
             "calles": [ ... ]
          }
        }

        ESTRUCTURA DETALLADA DEL DIAGRAMA (JSON):
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
             - "type": "text", "number", "date", "file" (para documentos), "list" (lista), "table" (tabla), "checkbox", "select".
             - "required": true | false.
             - "options": Opciones de configuración (ej: para tipo "select", opciones separadas por comas "Aprobado,Rechazado"; para "table", columnas separadas por comas).

        2. "enlaces": Una lista de conexiones direccionales (flechas). Cada enlace contiene:
           - "id": UUID v4 único.
           - "origen": {"elementoId": "id_nodo_origen", "puertoId": "top|bottom|left|right|p1|p2|p3"} (usa "bottom" o "right" para salir).
           - "destino": {"elementoId": "id_nodo_destino", "puertoId": "top|bottom|left|right|p1|p2|p3"} (usa "top" o "left" para entrar).
           - "condicion": Etiqueta del enlace/bifurcación (ej: "SI", "NO"). Si no hay condición, dejar vacío "".
           - "vertices": Siempre un array vacío [].

        3. "calles": Una lista de carriles (roles o actores). Cada carril contiene:
           - "id": UUID v4 único.
           - "tipo": "lane-v" (carril vertical) o "lane-h" (carril horizontal).
           - "nombre": Rol o actor del carril (ej: "Cliente", "Vendedor", "Aprobador").
           - "posicion": {"x": int, "y": int}
           - "tamano": {"width": int, "height": int}
           - "elementosContenidos": Lista de strings con los IDs de los elementos contenidos en este carril.

        REGLAS DE MODIFICACIÓN DEL DIAGRAMA:
        1. PRESERVACIÓN DE IDs: Conserva de forma estricta los IDs de los elementos (nodos, enlaces, calles) existentes. No los vuelvas a generar para elementos que permanecen en el lienzo. Solo genera nuevos IDs (UUIDv4) para celdas totalmente nuevas.
        2. ASOCIACIÓN OBLIGATORIA DE CALLES: **Todos** los elementos del diagrama (incluyendo "start" y "end") deben tener obligatoriamente asignado el ID de la calle donde están ubicados en su propiedad `"calleId"` (nunca dejes `calleId: ""`), y ese ID del elemento debe estar listado en el arreglo `"elementosContenidos"` de esa calle.
        3. COORDENADAS COHERENTES Y CENTRADO EXACTO: Las coordenadas (x, y) de los elementos deben estar físicamente dentro del rectángulo de su calle/carril:
           - CENTRADO HORIZONTAL EN CALLES VERTICALES: Todo elemento contenido en una calle vertical DEBE centrarse horizontalmente de forma exacta dentro del ancho de dicha calle. La fórmula obligatoria para la coordenada x es: `nodo.posicion.x = calle.posicion.x + (calle.tamano.width / 2) - (nodo.tamano.width / 2)`. Esto evita que los elementos queden fuera de su calle o a caballo/mitad entre dos calles.
           - EVITAR SOBREPOSICIONES Y COLISIONES: Los elementos nunca deben superponerse. Asegura un espaciamiento vertical (eje Y) de al menos 100px a 150px entre nodos sucesivos en la misma calle.
        4. ELIMINACIÓN: Si eliminas un nodo, quita todas sus referencias en "elementosContenidos" de la calle y elimina cualquier enlace ("enlaces") que tenga a este nodo como origen o destino.
        5. CALLES VERTICALES OBLIGATORIAS: Todas las calles/carriles que crees deben ser obligatoriamente verticales (`"tipo": "lane-v"`). No uses nunca calles horizontales (`lane-h`).
        6. CONECTIVIDAD TOTAL Y DIRECCIÓN VERTICAL DEL FLUJO: Todos los elementos/nodos del diagrama deben venir conectados lógicamente desde el principio. Cuando crees o agregues un nuevo elemento, genera inmediatamente las conexiones correspondientes en el arreglo de `enlaces` para que forme parte del flujo.
           - FLUJO VERTICAL: El flujo dentro de una misma calle debe ser estrictamente vertical, progresando hacia abajo (incrementando la coordenada `y`). Por ende, los enlaces entre nodos de una misma calle deben conectar el puerto `bottom` (origen) al puerto `top` (destino).
           - FLUJO HORIZONTAL TRANSICIONAL: Solo se permiten enlaces horizontales (salidas por `right` o `left`) cuando el flujo sale de una calle para entrar a otra calle diferente.
           - EVITAR CRUCE DE FLECHAS SOBRE ELEMENTOS: Las flechas/enlaces deben fluir de forma directa y limpia sin atravesar ni cruzar por encima de otros nodos intermedios.

        EJEMPLO DE DIAGRAMA:
        ```json
        {
          "elementos": [
            {
              "id": "f7223b1f-080b-401d-b59e-03d77f1e01bc",
              "tipo": "start",
              "nombre": "",
              "posicion": { "x": 165, "y": 120 },
              "tamano": { "width": 30, "height": 30 },
              "color": "#1e293b",
              "calleId": "4f1123da-9264-4388-bb9d-9cf8b9fe7608",
              "formulario": []
            },
            {
              "id": "e5450421-14a9-49ed-8bfe-d8fe3bb8e222",
              "tipo": "activity",
              "nombre": "seleccionar producto",
              "posicion": { "x": 115, "y": 210 },
              "tamano": { "width": 130, "height": 60 },
              "color": "#4f46e5",
              "calleId": "4f1123da-9264-4388-bb9d-9cf8b9fe7608",
              "formulario": []
            },
            {
              "id": "c6e280c4-dada-4e47-9c9f-ca85a01d2a41",
              "tipo": "activity",
              "nombre": "solicitar compra",
              "posicion": { "x": 115, "y": 310 },
              "tamano": { "width": 130, "height": 60 },
              "color": "#4f46e5",
              "calleId": "4f1123da-9264-4388-bb9d-9cf8b9fe7608",
              "formulario": [
                { "id": "field_ii4na48", "name": "documento", "type": "file", "required": true }
              ]
            },
            {
              "id": "4f6af4cf-48e0-4514-a3e1-b5ec96489eac",
              "tipo": "activity",
              "nombre": "Recibir solicitud",
              "posicion": { "x": 505, "y": 310 },
              "tamano": { "width": 130, "height": 60 },
              "color": "#4f46e5",
              "calleId": "b2cd6f41-00cf-46e2-bddd-83488b4db3fc",
              "formulario": []
            },
            {
              "id": "30b2685d-7c76-430a-a044-6328f3d51f04",
              "tipo": "decision",
              "nombre": "¿hay stock del producto?",
              "posicion": { "x": 505, "y": 420 },
              "tamano": { "width": 130, "height": 60 },
              "color": "#fef08a",
              "calleId": "b2cd6f41-00cf-46e2-bddd-83488b4db3fc",
              "formulario": []
            },
            {
              "id": "ac9b2c49-276f-47a8-833d-6d487e659aef",
              "tipo": "activity",
              "nombre": "informar precios",
              "posicion": { "x": 505, "y": 530 },
              "tamano": { "width": 130, "height": 60 },
              "color": "#4f46e5",
              "calleId": "b2cd6f41-00cf-46e2-bddd-83488b4db3fc",
              "formulario": []
            },
            {
              "id": "dbf9de8a-2596-4d45-8ebc-9f56e41bf894",
              "tipo": "activity",
              "nombre": "recibir informacion",
              "posicion": { "x": 115, "y": 530 },
              "tamano": { "width": 130, "height": 60 },
              "color": "#4f46e5",
              "calleId": "4f1123da-9264-4388-bb9d-9cf8b9fe7608",
              "formulario": []
            },
            {
              "id": "97cb090a-321d-409c-88c7-0d684ce5fa53",
              "tipo": "end",
              "nombre": "",
              "posicion": { "x": 165, "y": 660 },
              "tamano": { "width": 30, "height": 30 },
              "color": "#ffffff",
              "calleId": "4f1123da-9264-4388-bb9d-9cf8b9fe7608",
              "formulario": []
            }
          ],
          "enlaces": [
            {
              "id": "link_1",
              "origen": { "elementoId": "f7223b1f-080b-401d-b59e-03d77f1e01bc", "puertoId": "bottom" },
              "destino": { "elementoId": "e5450421-14a9-49ed-8bfe-d8fe3bb8e222", "puertoId": "top" },
              "condicion": "",
              "vertices": []
            },
            {
              "id": "link_2",
              "origen": { "elementoId": "e5450421-14a9-49ed-8bfe-d8fe3bb8e222", "puertoId": "bottom" },
              "destino": { "elementoId": "c6e280c4-dada-4e47-9c9f-ca85a01d2a41", "puertoId": "top" },
              "condicion": "",
              "vertices": []
            },
            {
              "id": "link_3",
              "origen": { "elementoId": "c6e280c4-dada-4e47-9c9f-ca85a01d2a41", "puertoId": "right" },
              "destino": { "elementoId": "4f6af4cf-48e0-4514-a3e1-b5ec96489eac", "puertoId": "left" },
              "condicion": "",
              "vertices": []
            },
            {
              "id": "link_4",
              "origen": { "elementoId": "4f6af4cf-48e0-4514-a3e1-b5ec96489eac", "puertoId": "bottom" },
              "destino": { "elementoId": "30b2685d-7c76-430a-a044-6328f3d51f04", "puertoId": "top" },
              "condicion": "",
              "vertices": []
            },
            {
              "id": "link_5",
              "origen": { "elementoId": "30b2685d-7c76-430a-a044-6328f3d51f04", "puertoId": "bottom" },
              "destino": { "elementoId": "ac9b2c49-276f-47a8-833d-6d487e659aef", "puertoId": "top" },
              "condicion": "SI",
              "vertices": []
            },
            {
              "id": "link_6",
              "origen": { "elementoId": "ac9b2c49-276f-47a8-833d-6d487e659aef", "puertoId": "left" },
              "destino": { "elementoId": "dbf9de8a-2596-4d45-8ebc-9f56e41bf894", "puertoId": "right" },
              "condicion": "",
              "vertices": []
            },
            {
              "id": "link_7",
              "origen": { "elementoId": "dbf9de8a-2596-4d45-8ebc-9f56e41bf894", "puertoId": "bottom" },
              "destino": { "elementoId": "97cb090a-321d-409c-88c7-0d684ce5fa53", "puertoId": "top" },
              "condicion": "",
              "vertices": []
            }
          ],
          "calles": [
            {
              "id": "4f1123da-9264-4388-bb9d-9cf8b9fe7608",
              "tipo": "lane-v",
              "nombre": "Cliente",
              "posicion": { "x": 70, "y": 80 },
              "tamano": { "width": 220, "height": 800 },
              "elementosContenidos": [
                "f7223b1f-080b-401d-b59e-03d77f1e01bc",
                "e5450421-14a9-49ed-8bfe-d8fe3bb8e222",
                "c6e280c4-dada-4e47-9c9f-ca85a01d2a41",
                "dbf9de8a-2596-4d45-8ebc-9f56e41bf894",
                "97cb090a-321d-409c-88c7-0d684ce5fa53"
              ]
            },
            {
              "id": "b2cd6f41-00cf-46e2-bddd-83488b4db3fc",
              "tipo": "lane-v",
              "nombre": "Vendedor",
              "posicion": { "x": 460, "y": 80 },
              "tamano": { "width": 220, "height": 800 },
              "elementosContenidos": [
                "4f6af4cf-48e0-4514-a3e1-b5ec96489eac",
                "30b2685d-7c76-430a-a044-6328f3d51f04",
                "ac9b2c49-276f-47a8-833d-6d487e659aef"
              ]
            }
          ]
        }
        ```
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
            parsed_json = json.loads(raw_content)
            
            print("\n📤 [CHAT DIAGRAM - OUTPUT RESPONSE]:")
            print(json.dumps(parsed_json, indent=2, ensure_ascii=False))
            print("==================================================\n")
            
            return parsed_json

        except Exception as error:
            print(f"Error en Agent Diagram Chat: {error}")
            return {
                "response": f"Lo siento, ocurrió un error al procesar el diagrama: {str(error)}",
                "diagram": current_state_dict
            }
