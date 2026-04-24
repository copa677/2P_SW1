package back_1erP.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CollaborationMessage {
    private String type;      // MOVE, ADD, DELETE, JOIN, LEAVE
    private String projectId;
    private String userId;
    private String username;
    private Object payload;    // Datos específicos del evento (ej: coordenadas {x: 10, y: 20})
}
