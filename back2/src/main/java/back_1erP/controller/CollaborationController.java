package back_1erP.controller;

import back_1erP.dto.CollaborationMessage;
import back_1erP.listener.WebSocketEventListener;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.handler.annotation.SendTo;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.stereotype.Controller;

@Controller
@RequiredArgsConstructor
public class CollaborationController {

    private final WebSocketEventListener sessionEventListener;

    /**
     * Recibe actualizaciones del diagrama de un cliente y las retransmite a todos
     * los colaboradores suscritos al proyecto específico.
     */
    @MessageMapping("/project/{projectId}/update")
    @SendTo("/topic/project/{projectId}")
    public CollaborationMessage broadcastUpdate(
            @DestinationVariable String projectId,
            @Payload CollaborationMessage message,
            SimpMessageHeaderAccessor headerAccessor) {
        
        // Registrar la sesión para que el listener sepa quién es si se desconecta
        sessionEventListener.registerUserSession(
                headerAccessor.getSessionId(),
                "project",
                projectId,
                message.getUserId(),
                message.getUsername()
        );
        
        return message; 
    }

    /**
     * Notifica el estado de presencia (unirse/salir)
     */
    @MessageMapping("/project/{projectId}/presence")
    @SendTo("/topic/project/{projectId}/presence")
    public CollaborationMessage handlePresence(
            @DestinationVariable String projectId,
            @Payload CollaborationMessage message) {
        return message;
    }

    /**
     * Recibe actualizaciones del documento de un cliente y las retransmite a todos
     * los colaboradores suscritos al documento específico.
     */
    @MessageMapping("/document/{documentId}/update")
    @SendTo("/topic/document/{documentId}")
    public CollaborationMessage broadcastDocumentUpdate(
            @DestinationVariable String documentId,
            @Payload CollaborationMessage message,
            SimpMessageHeaderAccessor headerAccessor) {
        
        // Registrar la sesión para que el listener sepa quién es si se desconecta
        sessionEventListener.registerUserSession(
                headerAccessor.getSessionId(),
                "document",
                documentId,
                message.getUserId(),
                message.getUsername()
        );
        
        return message; 
    }

    /**
     * Notifica el estado de presencia (unirse/salir) en el documento
     */
    @MessageMapping("/document/{documentId}/presence")
    @SendTo("/topic/document/{documentId}/presence")
    public CollaborationMessage handleDocumentPresence(
            @DestinationVariable String documentId,
            @Payload CollaborationMessage message) {
        return message;
    }
}
