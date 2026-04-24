import os
from dotenv import load_dotenv
from google import genai

load_dotenv()

class Config:
    GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
    # Usamos gemini-1.5-flash por su velocidad y ventana de contexto gratuita
    GEMINI_MODEL = "gemini-3.1-flash-lite-preview" 
    PORT = int(os.getenv("PORT", 8000))

# Verificación de API Key
if not Config.GOOGLE_API_KEY:
    raise ValueError("No se encontró GOOGLE_API_KEY en el archivo .env")

def get_client():
    """Retorna el cliente de la nueva SDK google-genai."""
    try:
        return genai.Client(api_key=Config.GOOGLE_API_KEY)
    except Exception as e:
        print(f"Error al inicializar el cliente de Gemini: {e}")
        return None