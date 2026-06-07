import json
from typing import Optional, List, Any
from app.core.config import get_client, Config

class AnalysisService:
    """Servicio para analizar flujos UML detectando fallas y cuellos de botella."""

    def __init__(self):
        self.client = get_client()
        self.system_prompt = """
        Eres un Ingeniero de Procesos y Especialista en QA experto en Diagramas de Actividad UML 2.5.
        Tu tarea es realizar un análisis profundo de un flujo de trabajo para detectar:
        
        1. FALLAS ESTRUCTURALES:
           - Nodos sin salida (excepto nodos finales).
           - Nodos de decisión sin múltiples ramas de salida.
           - Falta de nodo inicial o final.
           - Nodos aislados (huérfanos).
           
        2. CUELLOS DE BOTELLA (Analizando datos históricos si se proveen):
           - Identificar pasos que toman significativamente más tiempo que el promedio.
           - Detectar acumulaciones de procesos en nodos específicos.
           
        3. OPTIMIZACIONES:
           - Sugerir el uso de Fork/Join para paralelizar tareas.
           - Simplificar flujos redundantes.

        FORMATO DE RESPUESTA (JSON):
        {
          "summary": "Resumen general del estado del flujo",
          "issues": [
            { "type": "error|warning|info", "nodeId": "id", "message": "Descripción detallada", "suggestion": "Cómo arreglarlo" }
          ],
          "bottlenecks": [
            { "nodeId": "id", "severity": "alta|media|baja", "reason": "Por qué es un cuello de botella" }
          ],
          "score": 0-100 (Calidad del flujo)
        }
        Responde EXCLUSIVAMENTE con el objeto JSON.
        """

    async def analyze(self, state: Any, history: Optional[List[dict]] = None) -> Any:
        """
        Analiza el estado y el historial para generar un informe.
        """
        if not self.client:
            return {"error": "Cliente de Groq no inicializado."}

        current_state_str = json.dumps(state, indent=2)
        history_str = json.dumps(history, indent=2) if history else "No se proporcionaron datos históricos de ejecución."

        full_prompt = f"""
        {self.system_prompt}
        
        ESTADO DEL DIAGRAMA:
        {current_state_str}
        
        DATOS HISTÓRICOS DE EJECUCIÓN (History Logs):
        {history_str}
        
        Realiza el análisis y devuelve el JSON solicitado.
        """

        try:
            completion = self.client.chat.completions.create(
                model=Config.GROQ_MODEL,
                messages=[{"role": "user", "content": full_prompt}],
                temperature=0.1,
                max_completion_tokens=4000,
                response_format={ "type": "json_object" }
            )

            text = completion.choices[0].message.content or ""
            return json.loads(text.strip())

        except Exception as error:
            print(f"Error en AnalysisService: {error}")
            return {"error": f"Error al analizar el flujo: {str(error)}"}
