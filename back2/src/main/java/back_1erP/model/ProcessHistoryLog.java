package back_1erP.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "process_history")
public class ProcessHistoryLog {

    @Id
    private String id;
    
    private String processInstanceId;
    private String nodeId;
    private String nodeLabel;
    private String completedBy;
    private String action; // START, COMPLETE, CANCEL
    private LocalDateTime timestamp;
    @Builder.Default
    private Map<String, Object> submittedData = new HashMap<>();
}
