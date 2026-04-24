from app.core.config import get_client, Config
from typing import Optional

class AgentService:
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

    async def chat(self, message: str, history: Optional[list] = None):
        if not self.client:
            return "Error: Cliente de Gemini no inicializado."

        try:
            # Construimos el prompt con el historial si existe
            full_context = self.system_prompt
            if history:
                for h in history:
                    role = "Usuario" if h.get("role") == "user" else "Agente"
                    full_context += f"\n{role}: {h.get('parts', [''])[0]}"
            
            full_context += f"\nUsuario: {message}"

            # Usamos generate_content con el nuevo cliente
            response = self.client.models.generate_content(
                model=Config.GEMINI_MODEL,
                contents=full_context
            )
            return response.text
        except Exception as e:
            print(f"Error en Agent Chat (New SDK): {e}")
            return f"Error al procesar el chat: {str(e)}"
