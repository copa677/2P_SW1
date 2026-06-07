import os
import json
from typing import Dict, Any

def load_json_examples() -> str:
    """
    Carga los archivos JSON de la carpeta de ejemplos y los formatea como una cadena
    para ser inyectada en el prompt de la IA.
    """
    examples_path = os.path.join(os.getcwd(), "ejemplos de json del front")
    if not os.path.exists(examples_path):
        return ""

    examples_summary = []
    for filename in os.listdir(examples_path):
        if filename.endswith(".json"):
            file_path = os.path.join(examples_path, filename)
            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    # Tomamos solo una parte representativa si el archivo es muy grande
                    # o simplemente el nombre y la estructura clave
                    examples_summary.append(f"Archivo: {filename}\nContenido: {json.dumps(data)[:2000]}...")
            except Exception as e:
                print(f"Error cargando ejemplo {filename}: {e}")

    return "\n\n".join(examples_summary)
