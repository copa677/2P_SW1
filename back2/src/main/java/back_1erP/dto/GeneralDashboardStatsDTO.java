package back_1erP.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GeneralDashboardStatsDTO {
    private long totalProjects;
    private long totalInstances;
    private long completedInstances;
    private long inProgressInstances;
    private double completionRate;
    private double averageCycleTimeHours;
    private long totalTasks;
    private long pendingTasks;
    private long completedTasks;
    private Map<String, Long> tasksByLane;
    private long totalDocuments;
    private double totalDocumentsSizeMb;
}
