import os
from dotenv import load_dotenv
from groq import Groq

load_dotenv()


class Config:
    """Clase de configuración global del sistema."""

    GROQ_API_KEY = os.getenv("GROQ_API_KEY")
    GROQ_MODEL = "llama-3.3-70b-versatile"  # Modelo proporcionado por el usuario
    GROQ_DL_MODEL = os.getenv("GROQ_DL_MODEL", "openai/gpt-oss-120b")  # Modelo para deep learning y analítica
    PORT = int(os.getenv("PORT", 8000))


if not Config.GROQ_API_KEY:
    print("ADVERTENCIA: No se encontró GROQ_API_KEY en el archivo .env")


def get_client() -> Groq | None:
    """Retorna el cliente de la SDK de Groq.
    
    Returns:
        Groq | None: Instancia del cliente o None si hay error.
    """
    try:
        return Groq(api_key=Config.GROQ_API_KEY)
    except Exception as error:
        print(f"Error al inicializar el cliente de Groq: {error}")
        return None