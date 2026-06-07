package back_1erP.config;

import com.google.auth.oauth2.GoogleCredentials;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;

import jakarta.annotation.PostConstruct;
import java.io.IOException;

@Configuration
public class FirebaseConfig {

    @PostConstruct
    public void initialize() {
        try {
            // Intentamos cargar primero desde el classpath, luego desde una ruta externa si
            // falla
            Resource resource = new ClassPathResource("firebase-service-account.json");

            // Si no está en el classpath (común en Docker), buscamos en la ruta montada
            if (!resource.exists()) {
                resource = new FileSystemResource("/app/resources/firebase-service-account.json");
            }

            System.out.println("Buscando archivo de Firebase en: " + resource.getDescription());

            if (resource.exists()) {
                FirebaseOptions options = FirebaseOptions.builder()
                        .setCredentials(GoogleCredentials.fromStream(resource.getInputStream()))
                        .build();

                if (FirebaseApp.getApps().isEmpty()) {
                    FirebaseApp.initializeApp(options);
                    System.out.println("✅ Firebase se ha inicializado correctamente.");
                }
            } else {
                System.err.println(
                        "❌ ERROR: El archivo 'firebase-service-account.json' NO EXISTE en src/main/resources/");
                System.err.println("Asegúrate de que el nombre sea exacto y que esté en la carpeta resources.");
            }
        } catch (IOException e) {
            System.err.println("Error initializing Firebase: " + e.getMessage());
        }
    }
}
