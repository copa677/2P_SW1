package back_1erP.service;

import back_1erP.dto.GeneralDashboardStatsDTO;
import back_1erP.model.ProcessInstance;
import back_1erP.model.Project;
import back_1erP.model.TaskInstance;
import back_1erP.repository.ProcessRepository;
import back_1erP.repository.ProjectRepository;
import back_1erP.repository.TaskInstanceRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.ListObjectsV2Request;
import software.amazon.awssdk.services.s3.model.ListObjectsV2Response;
import software.amazon.awssdk.services.s3.model.S3Object;

import java.time.Duration;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class GeneralDashboardService {

    private final ProjectRepository projectRepository;
    private final ProcessRepository processRepository;
    private final TaskInstanceRepository taskInstanceRepository;
    private final S3Client s3Client;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Value("${aws.s3.bucket-name}")
    private String bucketName;

    public GeneralDashboardStatsDTO getGeneralStats() {
        // 1. Proyectos
        long totalProjects = projectRepository.count();

        // 2. Instancias de Proceso
        List<ProcessInstance> instances = processRepository.findAll();
        long totalInstances = instances.size();
        long completedInstances = 0;
        long inProgressInstances = 0;
        double totalDurationMinutes = 0.0;

        for (ProcessInstance pi : instances) {
            if ("COMPLETED".equalsIgnoreCase(pi.getStatus())) {
                completedInstances++;
                if (pi.getStartDate() != null && pi.getEndDate() != null) {
                    totalDurationMinutes += Duration.between(pi.getStartDate(), pi.getEndDate()).toMinutes();
                }
            } else if ("IN_PROGRESS".equalsIgnoreCase(pi.getStatus())) {
                inProgressInstances++;
            }
        }

        double completionRate = totalInstances > 0 ? (completedInstances * 100.0) / totalInstances : 0.0;
        double averageCycleTimeHours = completedInstances > 0 ? (totalDurationMinutes / 60.0) / completedInstances : 0.0;

        // 3. Tareas e Instancias de Tarea
        List<TaskInstance> tasks = taskInstanceRepository.findAll();
        long totalTasks = tasks.size();
        long pendingTasks = 0;
        long completedTasks = 0;

        for (TaskInstance ti : tasks) {
            if ("PENDING".equalsIgnoreCase(ti.getStatus())) {
                pendingTasks++;
            } else if ("COMPLETED".equalsIgnoreCase(ti.getStatus())) {
                completedTasks++;
            }
        }

        // 4. Cargar Nombres de Carriles de los Proyectos para agrupar
        Map<String, String> laneNameMap = new HashMap<>();
        List<Project> projects = projectRepository.findAll();
        for (Project p : projects) {
            if (p.getData() != null) {
                try {
                    JsonNode root = objectMapper.valueToTree(p.getData());
                    if (root.has("calles") && root.get("calles").isArray()) {
                        for (JsonNode lane : root.get("calles")) {
                            String id = lane.path("id").asText(null);
                            String name = lane.path("nombre").asText("Calle");
                            if (id != null) {
                                laneNameMap.put(id, name);
                            }
                        }
                    }
                } catch (Exception e) {
                    // Ignorar errores de mapeo individuales
                }
            }
        }

        // Agrupar tareas pendientes por carril
        Map<String, Long> tasksByLane = new HashMap<>();
        for (TaskInstance ti : tasks) {
            if ("PENDING".equalsIgnoreCase(ti.getStatus())) {
                String laneName = laneNameMap.getOrDefault(ti.getCalleId(), "Sin Asignar / General");
                tasksByLane.put(laneName, tasksByLane.getOrDefault(laneName, 0L) + 1);
            }
        }

        // 5. Documentos en AWS S3
        long totalDocuments = 0;
        double totalDocumentsSizeMb = 0.0;
        try {
            ListObjectsV2Request listReq = ListObjectsV2Request.builder()
                    .bucket(bucketName)
                    .build();
            ListObjectsV2Response listRes = s3Client.listObjectsV2(listReq);
            if (listRes.hasContents()) {
                totalDocuments = listRes.contents().size();
                long bytesSum = listRes.contents().stream().mapToLong(S3Object::size).sum();
                totalDocumentsSizeMb = bytesSum / (1024.0 * 1024.0);
            }
        } catch (Exception e) {
            System.err.println("Error al obtener estadísticas de S3 en el Dashboard: " + e.getMessage());
        }

        return GeneralDashboardStatsDTO.builder()
                .totalProjects(totalProjects)
                .totalInstances(totalInstances)
                .completedInstances(completedInstances)
                .inProgressInstances(inProgressInstances)
                .completionRate(completionRate)
                .averageCycleTimeHours(averageCycleTimeHours)
                .totalTasks(totalTasks)
                .pendingTasks(pendingTasks)
                .completedTasks(completedTasks)
                .tasksByLane(tasksByLane)
                .totalDocuments(totalDocuments)
                .totalDocumentsSizeMb(totalDocumentsSizeMb)
                .build();
    }
}
