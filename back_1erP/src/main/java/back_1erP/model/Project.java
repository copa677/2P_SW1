package back_1erP.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.annotation.Version;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "projects")
public class Project {

    @Id
    private String id;

    private String name;
    private String description;
    
    // ID del usuario dueño del proyecto
    private String ownerId;

    // Lista de IDs de usuarios colaboradores
    private List<String> collaboratorIds;

    public List<String> getCollaboratorIds() {
        if (collaboratorIds == null) {
            collaboratorIds = new ArrayList<>();
        }
        return collaboratorIds;
    }

    // Estructura de datos de JointJS (cells, etc.)
    // Usamos Map para permitir cualquier JSON dinámico de JointJS
    private Object data;

    private int elementCount;

    @CreatedDate
    private LocalDateTime createdAt;

    @LastModifiedDate
    private LocalDateTime updatedAt;

    @Version
    private Long version;
}
