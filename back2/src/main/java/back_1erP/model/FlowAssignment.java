package back_1erP.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "flow_assignments")
public class FlowAssignment {

    @Id
    private String id;
    
    private String projectId;
    private String projectName;
    private List<LaneAssignment> assignments;
    private String configuredBy;
    private LocalDateTime updatedAt;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class LaneAssignment {
        private String calleId;
        private String calleNombre;
        private String assignedUserId;
        private Role rol;
    }
}
