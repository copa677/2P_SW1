from typing import Optional, List
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
