import numpy as np
import json
import os

class Autoencoder:
    """Autoencoder neuronal implementado en Numpy para detección de anomalías en secuencias y tiempos."""

    def __init__(self, input_dim=5, hidden_dim=3, code_dim=2):
        self.input_dim = input_dim
        self.hidden_dim = hidden_dim
        self.code_dim = code_dim
        
        # Inicialización de pesos Xavier/Glorot
        self.W1 = np.random.randn(input_dim, hidden_dim) * np.sqrt(2.0 / input_dim)
        self.b1 = np.zeros((1, hidden_dim))
        
        self.W2 = np.random.randn(hidden_dim, code_dim) * np.sqrt(2.0 / hidden_dim)
        self.b2 = np.zeros((1, code_dim))
        
        self.W3 = np.random.randn(code_dim, hidden_dim) * np.sqrt(2.0 / code_dim)
        self.b3 = np.zeros((1, hidden_dim))
        
        self.W4 = np.random.randn(hidden_dim, input_dim) * np.sqrt(2.0 / hidden_dim)
        self.b4 = np.zeros((1, input_dim))
        
    def _sigmoid(self, x):
        return 1.0 / (1.0 + np.exp(-np.clip(x, -500, 500)))
        
    def _sigmoid_derivative(self, s):
        return s * (1.0 - s)
        
    def _relu(self, x):
        return np.maximum(0, x)
        
    def _relu_derivative(self, x):
        return (x > 0).astype(float)

    def forward(self, X):
        # Capa 1: Encoder Oculto
        self.z1 = np.dot(X, self.W1) + self.b1
        self.a1 = self._relu(self.z1)
        
        # Capa 2: Bottleneck (Código comprimido)
        self.z2 = np.dot(self.a1, self.W2) + self.b2
        self.a2 = self._sigmoid(self.z2)
        
        # Capa 3: Decoder Oculto
        self.z3 = np.dot(self.a2, self.W3) + self.b3
        self.a3 = self._relu(self.z3)
        
        # Capa 4: Reconstrucción de salida
        self.z4 = np.dot(self.a3, self.W4) + self.b4
        self.a4 = self.z4 # Activación lineal para regresión
        return self.a4

    def train_step(self, X, y, lr):
        # Paso Forward
        output = self.forward(X)
        
        # Backpropagation
        d_z4 = output - y # Derivada del error cuadrático medio
        d_W4 = np.dot(self.a3.T, d_z4)
        d_b4 = np.sum(d_z4, axis=0, keepdims=True)
        
        d_a3 = np.dot(d_z4, self.W4.T)
        d_z3 = d_a3 * self._relu_derivative(self.z3)
        d_W3 = np.dot(self.a2.T, d_z3)
        d_b3 = np.sum(d_z3, axis=0, keepdims=True)
        
        d_a2 = np.dot(d_z3, self.W3.T)
        d_z2 = d_a2 * self._sigmoid_derivative(self.a2)
        d_W2 = np.dot(self.a1.T, d_z2)
        d_b2 = np.sum(d_z2, axis=0, keepdims=True)
        
        d_a1 = np.dot(d_z2, self.W2.T)
        d_z1 = d_a1 * self._relu_derivative(self.z1)
        d_W1 = np.dot(X.T, d_z1)
        d_b1 = np.sum(d_z1, axis=0, keepdims=True)
        
        # Actualización de pesos y sesgos (SGD simple)
        self.W4 -= lr * d_W4
        self.b4 -= lr * d_b4
        self.W3 -= lr * d_W3
        self.b3 -= lr * d_b3
        self.W2 -= lr * d_W2
        self.b2 -= lr * d_b2
        self.W1 -= lr * d_W1
        self.b1 -= lr * d_b1
        
        loss = np.mean((output - y) ** 2)
        return loss

    def fit(self, X, epochs=500, lr=0.01):
        losses = []
        for epoch in range(epochs):
            loss = self.train_step(X, X, lr)
            losses.append(loss)
        return losses

    def get_reconstruction_error(self, X):
        reconstructed = self.forward(X)
        return np.mean((X - reconstructed) ** 2, axis=1)

    def save(self, filepath):
        weights = {
            "W1": self.W1.tolist(), "b1": self.b1.tolist(),
            "W2": self.W2.tolist(), "b2": self.b2.tolist(),
            "W3": self.W3.tolist(), "b3": self.b3.tolist(),
            "W4": self.W4.tolist(), "b4": self.b4.tolist(),
            "input_dim": self.input_dim,
            "hidden_dim": self.hidden_dim,
            "code_dim": self.code_dim
        }
        os.makedirs(os.path.dirname(filepath), exist_ok=True)
        with open(filepath, "w") as f:
            json.dump(weights, f)

    def load(self, filepath):
        if not os.path.exists(filepath):
            return False
        try:
            with open(filepath, "r") as f:
                weights = json.load(f)
            self.W1 = np.array(weights["W1"])
            self.b1 = np.array(weights["b1"])
            self.W2 = np.array(weights["W2"])
            self.b2 = np.array(weights["b2"])
            self.W3 = np.array(weights["W3"])
            self.b3 = np.array(weights["b3"])
            self.W4 = np.array(weights["W4"])
            self.b4 = np.array(weights["b4"])
            return True
        except Exception:
            return False
