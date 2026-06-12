import os
import numpy as np
from app.ml.autoencoder import Autoencoder
from app.ml.text_classifier import TextClassifier

class DeepLearningService:
    """Servicio que orquesta el entrenamiento y la inferencia de los modelos de Deep Learning."""

    def __init__(self):
        self.weights_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "ml", "weights")
        self.ae_path = os.path.join(self.weights_dir, "autoencoder_weights.json")
        self.tc_path = os.path.join(self.weights_dir, "text_classifier_weights.pkl")

        # Autoencoder para anomalías
        self.autoencoder = Autoencoder(input_dim=5, hidden_dim=3, code_dim=2)
        # Clasificador de texto MLP
        self.text_classifier = TextClassifier()

        # Cargar pesos guardados si existen
        self.autoencoder.load(self.ae_path)
        self.text_classifier.load(self.tc_path)

        # Si el clasificador no está entrenado, cargamos un corpus semilla básico
        if not self.text_classifier.is_trained:
            self._bootstrap_text_classifier()

    def _bootstrap_text_classifier(self):
        """Inicializa el clasificador con datos de ejemplo para evitar fallas iniciales."""
        texts = [
            "Revisión de contrato de arrendamiento y poderes notariales",
            "Redacción de adenda contractual y revisión de firmas legales",
            "Análisis de balance general, estados de cuenta y flujo de caja",
            "Verificación de depósito bancario y conciliación de facturas",
            "Mantenimiento preventivo de servidores web y base de datos",
            "Despliegue de servicio en la nube y configuración de DNS",
            "Atención al cliente por reclamo de servicio no disponible",
            "Consulta sobre facturación incorrecta y reembolso de saldos"
        ]
        labels = [
            "LEGAL", "LEGAL", "FINANCIERO", "FINANCIERO",
            "TECNICO", "TECNICO", "SOPORTE", "SOPORTE"
        ]
        self.text_classifier.fit(texts, labels)
        self.text_classifier.save(self.tc_path)

    def _map_to_float(self, val):
        """Mapea cualquier ID o cadena a un float determinista entre 0.0 y 1.0."""
        if not val:
            return 0.0
        return (abs(hash(str(val))) % 1000) / 1000.0

    def _vectorize_log(self, log):
        """Transforma un diccionario de log en un vector numérico de features de tamaño 5."""
        # 1. Duración en horas (asumimos un máximo de 168 horas para escalarlo)
        duration = float(log.get("durationHours", 0.0))
        norm_duration = min(duration / 168.0, 1.0)

        # 2. Es fin de semana (0 o 1)
        is_weekend = float(1.0 if log.get("isWeekend", False) else 0.0)

        # 3. Hora del día (normalizada entre 0 y 1)
        hour = float(log.get("hourOfDay", 12.0))
        norm_hour = min(max(hour / 23.0, 0.0), 1.0)

        # 4. ID del carril / rol (mapeado a float)
        calle_val = self._map_to_float(log.get("calleId", ""))

        # 5. ID de la actividad / nodo (mapeado a float)
        node_val = self._map_to_float(log.get("nodeId", ""))

        return [norm_duration, is_weekend, norm_hour, calle_val, node_val]

    def classify_texts(self, texts):
        """Asigna una categoría de prioridad o área y devuelve el nivel de confianza de la red."""
        if not texts:
            return []
        
        predictions = self.text_classifier.predict(texts)
        probabilities = self.text_classifier.predict_proba(texts)

        results = []
        for i, text in enumerate(texts):
            prob = max(probabilities[i]) if i < len(probabilities) else 1.0
            results.append({
                "text": text,
                "category": predictions[i],
                "confidence": float(prob)
            })
        return results

    def detect_anomalies(self, logs):
        """Ejecuta el Autoencoder para calcular el error de reconstrucción de cada log."""
        if not logs:
            return []

        vectors = [self._vectorize_log(log) for log in logs]
        X = np.array(vectors)

        errors = self.autoencoder.get_reconstruction_error(X)
        threshold = 0.08  # Umbral de anomalía fijo entrenado

        results = []
        for i, log in enumerate(logs):
            score = float(errors[i])
            is_anomaly = bool(score > threshold)
            
            # Calculamos una probabilidad visual basada en el score y el umbral
            anomaly_percentage = min((score / threshold) * 50.0 if score <= threshold else 50.0 + (score - threshold) * 200.0, 100.0)

            results.append({
                "nodeId": log.get("nodeId", ""),
                "nodeLabel": log.get("nodeLabel", ""),
                "calleId": log.get("calleId", ""),
                "calleNombre": log.get("calleNombre", ""),
                "durationHours": log.get("durationHours", 0.0),
                "anomalyScore": round(anomaly_percentage, 2),
                "isAnomaly": is_anomaly,
                "timestamp": log.get("timestamp", "")
            })
        return results

    def train_models(self, logs, texts_with_labels=None):
        """Realiza el entrenamiento en caliente de los modelos usando los datos más recientes."""
        training_metrics = {}

        # 1. Entrenar el Autoencoder si hay logs suficientes
        if logs:
            vectors = [self._vectorize_log(log) for log in logs]
            X = np.array(vectors)
            losses = self.autoencoder.fit(X, epochs=300, lr=0.05)
            self.autoencoder.save(self.ae_path)
            training_metrics["autoencoder_final_loss"] = float(losses[-1])
            training_metrics["autoencoder_samples"] = len(logs)

        # 2. Entrenar el Clasificador MLP si hay textos etiquetados provistos
        if texts_with_labels:
            texts = [item.get("text", "") for item in texts_with_labels]
            labels = [item.get("label", "GENERAL") for item in texts_with_labels]
            success = self.text_classifier.fit(texts, labels)
            if success:
                self.text_classifier.save(self.tc_path)
                training_metrics["text_classifier_samples"] = len(texts)
                training_metrics["text_classifier_classes"] = list(set(labels))

        return training_metrics

    async def filter_logs_by_prompt(self, logs, prompt: str):
        """Filtra una lista de logs basada en la consulta en lenguaje natural del usuario utilizando Groq LLM."""
        from app.core.config import get_client, Config
        import json
        
        client = get_client()
        if not client or not prompt:
            return logs, "No se aplicó filtro (cliente de Groq no disponible o prompt vacío)."
            
        simplified_logs = []
        for idx, log in enumerate(logs):
            simplified_logs.append({
                "index": idx,
                "nodeLabel": log.get("nodeLabel", ""),
                "calleNombre": log.get("calleNombre", ""),
                "durationHours": log.get("durationHours", 0.0),
                "status": log.get("status", ""),
                "timestamp": log.get("timestamp", "")
            })
            
        system_prompt = """
        Eres un asistente experto en análisis y filtrado de datos de auditoría de procesos.
        Tu tarea es filtrar un listado de logs en base al criterio en lenguaje natural solicitado por el usuario.
        
        CRITERIOS COMUNES:
        - Rango de fechas (ej: entre 2026-06-01 y 2026-06-15)
        - Fecha específica (ej: dia 10 de junio de 2026)
        - Duraciones (ej: duró más de 5 horas, duró menos de 1 hora)
        - Estados (ej: completadas, fallidas, en ejecución, etc.)
        - Nombre de actividad (ej: 'seleccionar producto')
        - Carril / Rol (ej: 'funcionario')
        
        FORMATO DE RESPUESTA (JSON):
        {
          "filtered_indices": [0, 2, 5], // Lista de enteros correspondientes a los índices que cumplen el criterio. Si todos cumplen, pon todos. Si ninguno, pon lista vacía.
          "explanation": "Breve explicación en español de qué se filtró (ej: 'Se muestran 3 tareas ejecutadas el día 10 de junio de 2026')"
        }
        Responde EXCLUSIVAMENTE con el objeto JSON estructurado, sin texto adicional.
        """
        
        user_content = f"""
        PROMPT DEL USUARIO: "{prompt}"
        
        DATOS DE LOGS A FILTRAR (JSON):
        {json.dumps(simplified_logs, indent=2)}
        
        Aplica el filtro y devuelve el JSON.
        """
        
        try:
            completion = client.chat.completions.create(
                model=Config.GROQ_DL_MODEL,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_content}
                ],
                temperature=0.1,
                max_completion_tokens=2000,
                response_format={ "type": "json_object" }
            )
            
            res_text = completion.choices[0].message.content or ""
            res_data = json.loads(res_text.strip())
            
            indices = res_data.get("filtered_indices", [])
            explanation = res_data.get("explanation", "Filtrado completado con éxito.")
            
            filtered_logs = [logs[i] for i in indices if 0 <= i < len(logs)]
            return filtered_logs, explanation
            
        except Exception as e:
            print(f"Error al filtrar logs con IA: {e}")
            return logs, f"Error al filtrar logs: {str(e)}"
