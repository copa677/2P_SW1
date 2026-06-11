import sys
import os
import numpy as np

# Añadir el directorio raíz al path para importar el módulo app
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.ml.autoencoder import Autoencoder
from app.ml.text_classifier import TextClassifier
from app.services.dl_service import DeepLearningService

def test_autoencoder():
    print("--- Probando Autoencoder ---")
    ae = Autoencoder(input_dim=5, hidden_dim=3, code_dim=2)
    
    # 10 muestras normales (simulando 1 hora de duración promedio)
    normal_data = np.array([
        [0.01, 0.0, 0.5, 0.2, 0.3],
        [0.02, 0.0, 0.6, 0.2, 0.3],
        [0.015, 0.0, 0.4, 0.2, 0.3],
        [0.012, 0.0, 0.55, 0.2, 0.3],
        [0.018, 0.0, 0.45, 0.2, 0.3],
        [0.01, 0.0, 0.5, 0.2, 0.3],
        [0.02, 0.0, 0.6, 0.2, 0.3],
        [0.015, 0.0, 0.4, 0.2, 0.3],
        [0.012, 0.0, 0.55, 0.2, 0.3],
        [0.018, 0.0, 0.45, 0.2, 0.3]
    ])
    
    losses = ae.fit(normal_data, epochs=100, lr=0.1)
    print(f"Pérdida inicial: {losses[0]:.6f} -> Pérdida final: {losses[-1]:.6f}")
    assert losses[-1] < losses[0], "La pérdida del Autoencoder debería disminuir durante el entrenamiento"

    # Muestra anómala (duración exagerada: 1.0 = 168 horas)
    anomaly_data = np.array([
        [1.0, 0.0, 0.5, 0.2, 0.3]
    ])
    
    err_normal = ae.get_reconstruction_error(normal_data)
    err_anomaly = ae.get_reconstruction_error(anomaly_data)
    
    print(f"Error normal promedio: {np.mean(err_normal):.6f}")
    print(f"Error anomalía: {err_anomaly[0]:.6f}")
    assert err_anomaly[0] > np.mean(err_normal), "El error de anomalía debería ser mayor al error normal"
    print("Autoencoder aprobado con éxito!\n")

def test_text_classifier():
    print("--- Probando TextClassifier ---")
    tc = TextClassifier()
    texts = [
        "Revisión de firmas legales y contrato de compraventa",
        "Validación legal de cláusulas del acuerdo de accionistas",
        "Cálculo de impuestos, balance financiero anual e ingresos",
        "Conciliación bancaria, depósito en caja y auditoría de egresos"
    ]
    labels = ["LEGAL", "LEGAL", "FINANCIERO", "FINANCIERO"]
    
    success = tc.fit(texts, labels)
    assert success, "El clasificador debería entrenarse correctamente"
    
    test_texts = [
        "El contrato firmado por el abogado",
        "Auditoría de las finanzas y cuentas bancarias"
    ]
    predictions = tc.predict(test_texts)
    print("Predicciones:", predictions)
    assert predictions[0] == "LEGAL", "Debería clasificar como LEGAL"
    assert predictions[1] == "FINANCIERO", "Debería clasificar como FINANCIERO"
    print("TextClassifier aprobado con éxito!\n")

if __name__ == "__main__":
    test_autoencoder()
    test_text_classifier()
    print("Todos los tests matemáticos del backend de IA pasaron correctamente.")
