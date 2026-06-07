package back_1erP.listener;

import back_1erP.dto.CollaborationMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.SimpMessageSendingOperations;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;
import org.springframework.web.socket.messaging.SessionSubscribeEvent;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Component
@RequiredArgsConstructor
@Slf4j
public class WebSocketEventListener {

    private final SimpMessageSendingOperations messagingTemplate;

    // Mapa para rastrear: SessionID -> (ProjectID + UserID + Username)
    private final Map<String, UserSessionInfo> sessionRegistry = new ConcurrentHashMap<>();

    @EventListener
    public void handleWebSocketSubscribeListener(SessionSubscribeEvent event) {
        StompHeaderAccessor headerAccessor = StompHeaderAccessor.wrap(event.getMessage());
        String destination = headerAccessor.getDestination();
        String sessionId = headerAccessor.getSessionId();

        // Si se suscribe a un proyecto: /topic/project/{projectId}
        if (destination != null && destination.startsWith("/topic/project/")) {
            String projectId = destination.substring("/topic/project/".length());
            
            // Nota: El userId y username deberían venir en los headers de conexión 
            // o ser extraídos después de que envíen el primer mensaje de JOIN.
            // Para simplificar, capturaremos estos datos en el próximo mensaje que envíen.
        }
    }

    /**
     * Registra la asociación de una sesión con un usuario cuando llega un mensaje de JOIN u otro.
     */
    public void registerUserSession(String sessionId, String projectId, String userId, String username) {
        sessionRegistry.put(sessionId, new UserSessionInfo(projectId, userId, username));
        log.info("Usuario {} registrado en sesión {} para el proyecto {}", username, sessionId, projectId);
    }

    @EventListener
    public void handleWebSocketDisconnectListener(SessionDisconnectEvent event) {
        StompHeaderAccessor headerAccessor = StompHeaderAccessor.wrap(event.getMessage());
        String sessionId = headerAccessor.getSessionId();

        UserSessionInfo userInfo = sessionRegistry.remove(sessionId);
        if (userInfo != null) {
            log.info("Desconexión detectada: Usuario {} dejó el proyecto {}", userInfo.username, userInfo.projectId);

            CollaborationMessage leaveMessage = CollaborationMessage.builder()
                    .type("USER_LEFT")
                    .projectId(userInfo.projectId)
                    .userId(userInfo.userId)
                    .username(userInfo.username)
                    .build();

            // Notificar a todos los demás en el proyecto
            messagingTemplate.convertAndSend("/topic/project/" + userInfo.projectId, leaveMessage);
        }
    }

    private record UserSessionInfo(String projectId, String userId, String username) {}
}
