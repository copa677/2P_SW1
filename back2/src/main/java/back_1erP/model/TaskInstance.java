package back_1erP.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "tasks")
public class TaskInstance {

    @Id
    private String id;
    
    private String processInstanceId;
    private String projectId;
    private String nodeId;
    private String nodeLabel;
    private String calleId;
    private String assignedUserId;
    private String status; // PENDING, COMPLETED
    private LocalDateTime createdAt;
}
