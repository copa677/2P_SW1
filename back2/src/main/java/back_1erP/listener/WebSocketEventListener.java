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
    public void registerUserSession(String sessionId, String type, String targetId, String userId, String username) {
        sessionRegistry.put(sessionId, new UserSessionInfo(type, targetId, userId, username));
        log.info("Usuario {} registrado en sesión {} para el {} {}", username, sessionId, type, targetId);
    }

    @EventListener
    public void handleWebSocketDisconnectListener(SessionDisconnectEvent event) {
        StompHeaderAccessor headerAccessor = StompHeaderAccessor.wrap(event.getMessage());
        String sessionId = headerAccessor.getSessionId();

        UserSessionInfo userInfo = sessionRegistry.remove(sessionId);
        if (userInfo != null) {
            log.info("Desconexión detectada: Usuario {} dejó {} {}", userInfo.username, userInfo.type, userInfo.targetId);

            CollaborationMessage leaveMessage = CollaborationMessage.builder()
                    .type("USER_LEFT")
                    .projectId(userInfo.targetId)
                    .userId(userInfo.userId)
                    .username(userInfo.username)
                    .build();

            // Notificar a todos los demás en el destino correspondiente
            String destination = "/topic/" + userInfo.type + "/" + userInfo.targetId;
            messagingTemplate.convertAndSend(destination, leaveMessage);
        }
    }

    private record UserSessionInfo(String type, String targetId, String userId, String username) {}
}
