package back_1erP.service;

import back_1erP.model.ProcessHistoryLog;
import back_1erP.model.ProcessInstance;
import back_1erP.model.Project;
import back_1erP.model.TaskInstance;
import back_1erP.repository.ProcessHistoryLogRepository;
import back_1erP.repository.ProcessRepository;
import back_1erP.repository.ProjectRepository;
import back_1erP.repository.TaskInstanceRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class IAIntegrationService {

    private final ProcessRepository processRepository;
    private final TaskInstanceRepository taskInstanceRepository;
    private final ProcessHistoryLogRepository processHistoryLogRepository;
    private final ProjectRepository projectRepository;
    
    private final RestTemplate restTemplate = new RestTemplate();

    @Value("${ia.api.url:http://localhost:5000/api/v1/analyzer}")
    private String iaApiUrl;

    /**
     * Recopila el historial de tareas de un proyecto y lo formatea para la IA.
     */
    public List<Map<String, Object>> getProjectExecutionLogs(String projectId) {
        List<TaskInstance> tasks = taskInstanceRepository.findByProjectId(projectId);
        List<Map<String, Object>> logs = new ArrayList<>();

        for (TaskInstance task : tasks) {
            Map<String, Object> logItem = new HashMap<>();
            logItem.put("nodeId", task.getNodeId());
            logItem.put("nodeLabel", task.getNodeLabel());
            logItem.put("calleId", task.getCalleId());
            
            // Si el nombre de la calle/rol es nulo, usamos el ID
            logItem.put("calleNombre", task.getCalleId()); 

            LocalDateTime end = LocalDateTime.now();
            boolean isCompleted = "COMPLETED".equals(task.getStatus());
            
            if (isCompleted) {
                // Buscar el log de finalización en el historial
                List<ProcessHistoryLog> history = processHistoryLogRepository.findByProcessInstanceId(task.getProcessInstanceId());
                Optional<ProcessHistoryLog> compLog = history.stream()
                        .filter(h -> task.getNodeId().equals(h.getNodeId()) && "COMPLETE".equals(h.getAction()))
                        .findFirst();
                if (compLog.isPresent()) {
                    end = compLog.get().getTimestamp();
                }
            }

            double durationHours = Duration.between(task.getCreatedAt(), end).toMillis() / 3600000.0;
            logItem.put("durationHours", durationHours);
            
            int dayOfWeek = end.getDayOfWeek().getValue();
            logItem.put("isWeekend", dayOfWeek >= 6);
            logItem.put("hourOfDay", end.getHour());
            logItem.put("status", task.getStatus());
            logItem.put("timestamp", task.getCreatedAt().toString());

            logs.add(logItem);
        }
        return logs;
    }

    /**
     * Obtiene los textos de los logs enviados en los formularios.
     */
    public List<String> getProjectFormTexts(String projectId) {
        List<ProcessInstance> instances = processRepository.findByProjectId(projectId);
        List<String> texts = new ArrayList<>();
        
        for (ProcessInstance instance : instances) {
            if (instance.getData() != null) {
                for (Object value : instance.getData().values()) {
                    if (value instanceof String && ((String) value).trim().length() > 5) {
                        texts.add((String) value);
                    }
                }
            }
        }
        
        // Agregar textos por defecto si la lista está vacía
        if (texts.isEmpty()) {
            texts.add("Revisión de formulario del trámite sin observaciones mayores.");
            texts.add("Se completa el paso de aprobación del proyecto exitosamente.");
        }
        
        return texts;
    }

    /**
     * Consulta las anomalías predichas por el Autoencoder de Deep Learning en FastAPI.
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> getDLAnomalies(String projectId, String prompt) {
        try {
            List<Map<String, Object>> logs = getProjectExecutionLogs(projectId);
            if (logs.isEmpty()) {
                return Collections.emptyMap();
            }

            Map<String, Object> request = new HashMap<>();
            request.put("logs", logs);
            if (prompt != null && !prompt.trim().isEmpty()) {
                request.put("prompt", prompt);
            }

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(request, headers);

            ResponseEntity<Map> response = restTemplate.postForEntity(
                    iaApiUrl + "/dl-kpis",
                    entity,
                    Map.class
            );

            if (response.getStatusCode() == HttpStatus.OK && response.getBody() != null) {
                return (Map<String, Object>) response.getBody();
            }
        } catch (Exception e) {
            log.error("Error consultando anomalías DL: ", e);
        }
        return Collections.emptyMap();
    }

    /**
     * Clasifica los textos de los formularios del proyecto mediante la red neuronal.
     */
    @SuppressWarnings("unchecked")
    public List<Map<String, Object>> getTextsClassification(String projectId) {
        try {
            List<String> texts = getProjectFormTexts(projectId);
            Map<String, Object> request = new HashMap<>();
            request.put("texts", texts);

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(request, headers);

            ResponseEntity<List> response = restTemplate.postForEntity(
                    iaApiUrl + "/text-classify",
                    entity,
                    List.class
            );

            if (response.getStatusCode() == HttpStatus.OK && response.getBody() != null) {
                return (List<Map<String, Object>>) response.getBody();
            }
        } catch (Exception e) {
            log.error("Error al clasificar textos: ", e);
        }
        return Collections.emptyList();
    }

    /**
     * Envía los datos de entrenamiento a FastAPI.
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> trainDLModels(String projectId) {
        try {
            List<Map<String, Object>> logs = getProjectExecutionLogs(projectId);
            List<String> texts = getProjectFormTexts(projectId);
            
            List<Map<String, Object>> textsWithLabels = new ArrayList<>();
            for (String text : texts) {
                Map<String, Object> tl = new HashMap<>();
                tl.put("text", text);
                // Asignamos una etiqueta ficticia para el entrenamiento supervisado en base a palabras claves simples
                if (text.toLowerCase().contains("pago") || text.toLowerCase().contains("financiero")) {
                    tl.put("label", "FINANCIERO");
                } else if (text.toLowerCase().contains("contrato") || text.toLowerCase().contains("legal")) {
                    tl.put("label", "LEGAL");
                } else {
                    tl.put("label", "GENERAL");
                }
                textsWithLabels.add(tl);
            }

            Map<String, Object> request = new HashMap<>();
            request.put("logs", logs);
            request.put("texts_with_labels", textsWithLabels);

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(request, headers);

            ResponseEntity<Map> response = restTemplate.postForEntity(
                    iaApiUrl + "/train",
                    entity,
                    Map.class
            );

            if (response.getStatusCode() == HttpStatus.OK && response.getBody() != null) {
                return (Map<String, Object>) response.getBody();
            }
        } catch (Exception e) {
            log.error("Error entrenando modelos DL en FastAPI: ", e);
        }
        return Collections.singletonMap("status", "error");
    }

    /**
     * Descarga el reporte PDF compilado dinámicamente desde FastAPI.
     */
    public byte[] downloadPDFReport(String projectId, String prompt) {
        try {
            Project project = projectRepository.findById(projectId).orElse(null);
            String projectName = (project != null) ? project.getName() : "Proyecto Genérico";
            
            // Obtener métricas y logs filtrados por el prompt
            Map<String, Object> anomaliesData = getDLAnomalies(projectId, prompt);
            List<Map<String, Object>> logs = (List<Map<String, Object>>) anomaliesData.get("anomalies");
            String explanation = (String) anomaliesData.get("explanation");
            
            if (logs == null || logs.isEmpty()) {
                logs = getProjectExecutionLogs(projectId);
            }

            // Consultar el reporte descriptivo general de la IA
            Map<String, Object> requestAI = new HashMap<>();
            requestAI.put("state", (project != null) ? project.getData() : new HashMap<>());
            requestAI.put("history", logs);
            
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            HttpEntity<Map<String, Object>> entityAI = new HttpEntity<>(requestAI, headers);
            
            Map<String, Object> anomaliesSummary = new HashMap<>();
            anomaliesSummary.put("summary", explanation != null && !explanation.isEmpty() ? explanation : "Flujo analizado con éxito.");
            
            // Si no hay prompt, usamos el análisis estándar, si no, usamos la explicación del prompt
            if (prompt == null || prompt.trim().isEmpty()) {
                try {
                    ResponseEntity<Map> responseAI = restTemplate.postForEntity(
                            iaApiUrl + "/analyze",
                            entityAI,
                            Map.class
                    );
                    if (responseAI.getStatusCode() == HttpStatus.OK && responseAI.getBody() != null) {
                        anomaliesSummary = responseAI.getBody();
                    }
                } catch (Exception ex) {
                    log.error("Error al consultar resumen descriptivo de IA: ", ex);
                }
            } else {
                anomaliesSummary.put("summary", "Reporte dinámico filtrado por criterio: \"" + prompt + "\".\n\nDiagnóstico: " + explanation);
            }

            // Llamar al endpoint /report de FastAPI para compilar el PDF
            Map<String, Object> reportRequest = new HashMap<>();
            reportRequest.put("projectName", projectName);
            reportRequest.put("logs", logs);
            reportRequest.put("anomaliesSummary", anomaliesSummary);

            HttpEntity<Map<String, Object>> entityReport = new HttpEntity<>(reportRequest, headers);

            ResponseEntity<byte[]> response = restTemplate.postForEntity(
                    iaApiUrl + "/report",
                    entityReport,
                    byte[].class
            );

            if (response.getStatusCode() == HttpStatus.OK && response.getBody() != null) {
                return response.getBody();
            }
        } catch (Exception e) {
            log.error("Error descargando PDF del reporte: ", e);
        }
        return new byte[0];
    }
}
