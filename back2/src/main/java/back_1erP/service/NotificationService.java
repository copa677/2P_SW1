package back_1erP.service;

import com.google.firebase.messaging.FirebaseMessaging;
import com.google.firebase.messaging.Message;
import com.google.firebase.messaging.Notification;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class NotificationService {

    public void sendPushNotification(List<String> tokens, String title, String body) {
        System.out.println("Intentando enviar notificación a " + (tokens != null ? tokens.size() : 0) + " dispositivos.");
        if (tokens == null || tokens.isEmpty()) {
            System.out.println("No hay tokens registrados para este trámite.");
            return;
        }

        for (String token : tokens) {
            try {
                Message message = Message.builder()
                        .setToken(token)
                        .setNotification(Notification.builder()
                                .setTitle(title)
                                .setBody(body)
                                .build())
                        .putData("click_action", "FLUTTER_NOTIFICATION_CLICK")
                        .build();

                String response = FirebaseMessaging.getInstance().send(message);
                System.out.println("Sent message to token: " + token + ", Response: " + response);
            } catch (Exception e) {
                System.err.println("Error sending push notification to token " + token + ": " + e.getMessage());
            }
        }
    }
}
