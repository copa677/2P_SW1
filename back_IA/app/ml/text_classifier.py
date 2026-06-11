import os
import pickle
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.neural_network import MLPClassifier

class TextClassifier:
    """Clasificador de texto neuronal MLP utilizando scikit-learn."""

    def __init__(self):
        self.vectorizer = TfidfVectorizer(max_features=500, stop_words=None)
        # Red neuronal perceptrón multicapa ligera con 1 capa oculta de 16 neuronas
        self.model = MLPClassifier(
            hidden_layer_sizes=(16,),
            activation='relu',
            solver='adam',
            max_iter=300,
            random_state=42
        )
        self.is_trained = False

    def fit(self, texts, labels):
        if not texts or not labels:
            return False
        try:
            X = self.vectorizer.fit_transform(texts)
            self.model.fit(X, labels)
            self.is_trained = True
            return True
        except Exception as e:
            print(f"Error entrenando TextClassifier: {e}")
            return False

    def predict(self, texts):
        if not self.is_trained:
            # Fallback por si el clasificador no ha sido entrenado aún
            return ["GENERAL" for _ in texts]
        try:
            X = self.vectorizer.transform(texts)
            return self.model.predict(X).tolist()
        except Exception as e:
            print(f"Error prediciendo en TextClassifier: {e}")
            return ["GENERAL" for _ in texts]

    def predict_proba(self, texts):
        if not self.is_trained:
            return [[1.0] for _ in texts]
        try:
            X = self.vectorizer.transform(texts)
            return self.model.predict_proba(X).tolist()
        except Exception as e:
            print(f"Error en predict_proba: {e}")
            return [[1.0] for _ in texts]

    def save(self, filepath):
        os.makedirs(os.path.dirname(filepath), exist_ok=True)
        data = {
            "vectorizer": self.vectorizer,
            "model": self.model,
            "is_trained": self.is_trained
        }
        try:
            with open(filepath, "wb") as f:
                pickle.dump(data, f)
            return True
        except Exception as e:
            print(f"Error guardando TextClassifier: {e}")
            return False

    def load(self, filepath):
        if not os.path.exists(filepath):
            return False
        try:
            with open(filepath, "rb") as f:
                data = pickle.load(f)
            self.vectorizer = data["vectorizer"]
            self.model = data["model"]
            self.is_trained = data["is_trained"]
            return True
        except Exception as e:
            print(f"Error cargando TextClassifier: {e}")
            return False
