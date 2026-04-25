package back_1erP.model;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Data
@Document(collection = "process_instances")
public class ProcessInstance {
    @Id
    private String id;
    private String projectId;
    private String projectName;
    private String trackingCode; // Máximo 8 caracteres
    private String status; // IN_PROGRESS, COMPLETED, CANCELLED
    private String initiatorId;
    private String initiatorName;
    private String currentNodeId;
    private String currentLaneName;
    
    private LocalDateTime startDate;
    private LocalDateTime endDate;
    
    // Almacena los datos de los formularios llenados: { "campo": "valor" }
    private Map<String, Object> data = new HashMap<>();
    
    // Historial de movimientos
    private List<HistoryLog> history = new ArrayList<>();

    @Data
    public static class HistoryLog {
        private String nodeId;
        private String nodeLabel;
        private String userId;
        private String userName;
        private String action; // Ej: "COMPLETED", "STARTED"
        private LocalDateTime timestamp;
        private Map<String, Object> submittedData;
    }
}
