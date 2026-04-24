import os
from dotenv import load_dotenv
from google import genai

# 1. Cargar variables de entorno
load_dotenv()

class Config:
    GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
    PORT = int(os.getenv("PORT", 8000))

# 2. Inicializar cliente
def get_client():
    if not Config.GOOGLE_API_KEY:
        print("❌ ERROR: No se encontró GOOGLE_API_KEY en el .env")
        return None
    try:
        return genai.Client(api_key=Config.GOOGLE_API_KEY)
    except Exception as e:
        print(f"❌ Error al inicializar el cliente: {e}")
        return None

# 3. Función de prueba
def probar_conexion_y_listar():
    client = get_client()
    if not client:
        return

    print("\n🔍 Conectando con Google AI Studio...")
    print("==========================================")
    
    try:
        # Listamos los modelos disponibles
        modelos = client.models.list()
        
        encontrado_gemma = False
        for model in modelos:
            print(f"✅ Disponible: {model.name}")
            if "gemma-4" in model.name:
                encontrado_gemma = True
        
        print("==========================================")
        if encontrado_gemma:
            print("🚀 ¡Gemma 4 está listo para usar en tu cuenta!")
        else:
            print("⚠️ Gemma 4 no aparece. Revisa si está disponible en tu región.")
            
    except Exception as e:
        print(f"❌ Error al listar modelos: {e}")

# 4. Punto de entrada para correr el script
if __name__ == "__main__":
    probar_conexion_y_listar()