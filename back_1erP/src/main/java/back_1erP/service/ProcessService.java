package back_1erP.service;

import back_1erP.model.ProcessInstance;
import back_1erP.model.Project;
import back_1erP.repository.ProcessRepository;
import back_1erP.repository.ProjectRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Random;

@Service
@RequiredArgsConstructor
public class ProcessService {
    private final ProcessRepository processRepository;
    private final ProjectRepository projectRepository;
    private final ObjectMapper objectMapper;

    public ProcessInstance startProcess(String projectId, String initiatorId, String initiatorName) throws Exception {
        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> new RuntimeException("Proyecto no encontrado"));

        ProcessInstance instance = new ProcessInstance();
        instance.setProjectId(projectId);
        instance.setProjectName(project.getName());
        instance.setTrackingCode(generateTrackingCode());
        instance.setStatus("IN_PROGRESS");
        instance.setInitiatorId(initiatorId);
        instance.setInitiatorName(initiatorName);
        instance.setStartDate(LocalDateTime.now());

        // Buscar el nodo inicial en el JSON
        String initialNodeId = findInitialNode(project.getData());
        if (initialNodeId == null) {
            throw new RuntimeException("No se encontró un nodo de inicio en el diagrama");
        }
        instance.setCurrentNodeId(initialNodeId);
        
        // Log de inicio
        ProcessInstance.HistoryLog log = new ProcessInstance.HistoryLog();
        log.setNodeId(initialNodeId);
        log.setNodeLabel("Inicio del Proceso");
        log.setUserId(initiatorId);
        log.setUserName(initiatorName);
        log.setAction("STARTED");
        log.setTimestamp(LocalDateTime.now());
        instance.getHistory().add(log);

        return processRepository.save(instance);
    }

    public ProcessInstance advanceProcess(String instanceId, String userId, String userName, Map<String, Object> submittedData) throws Exception {
        ProcessInstance instance = processRepository.findById(instanceId)
                .orElseThrow(() -> new RuntimeException("Instancia no encontrada"));

        Project project = projectRepository.findById(instance.getProjectId())
                .orElseThrow(() -> new RuntimeException("Proyecto no encontrado"));

        // Guardar datos en la "mochila" del proceso
        if (submittedData != null) {
            instance.getData().putAll(submittedData);
        }

        // Buscar el siguiente nodo en el JSON
        String nextNodeId = findNextNode(project.getData(), instance.getCurrentNodeId(), submittedData);
        
        // Registrar en historial
        ProcessInstance.HistoryLog log = new ProcessInstance.HistoryLog();
        log.setNodeId(instance.getCurrentNodeId());
        log.setNodeLabel("Paso Completado");
        log.setUserId(userId);
        log.setUserName(userName);
        log.setAction("COMPLETED");
        log.setTimestamp(LocalDateTime.now());
        log.setSubmittedData(submittedData);
        instance.getHistory().add(log);

        if (nextNodeId == null || isFinalNode(project.getData(), nextNodeId)) {
            instance.setStatus("COMPLETED");
            instance.setEndDate(LocalDateTime.now());
            instance.setCurrentNodeId(nextNodeId);
        } else {
            instance.setCurrentNodeId(nextNodeId);
        }

        return processRepository.save(instance);
    }

    public List<ProcessInstance> getInstancesByInitiator(String userId) {
        return processRepository.findByInitiatorId(userId);
    }

    private String generateTrackingCode() {
        String chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        StringBuilder code = new StringBuilder();
        Random rnd = new Random();
        while (code.length() < 8) {
            code.append(chars.charAt(rnd.nextInt(chars.length())));
        }
        return code.toString();
    }

    private String findInitialNode(Object data) throws Exception {
        if (data == null) return null;
        JsonNode root = objectMapper.valueToTree(data);
        JsonNode cells = root.get("cells");
        if (cells == null || !cells.isArray()) return null;

        for (JsonNode cell : cells) {
            String type = cell.path("type").asText();
            if ("uml.InitialNode".equals(type)) return cell.path("id").asText();
            
            if ("standard.Circle".equals(type)) {
                JsonNode attrs = cell.get("attrs");
                if (attrs != null && attrs.has("body")) {
                    String fill = attrs.get("body").path("fill").asText();
                    if ("#1e293b".equalsIgnoreCase(fill)) {
                        return cell.path("id").asText();
                    }
                }
            }
        }
        return null;
    }

    private String findNextNode(Object data, String currentNodeId, Map<String, Object> submittedData) throws Exception {
        if (data == null) return null;
        JsonNode root = objectMapper.valueToTree(data);
        JsonNode cells = root.get("cells");
        if (cells == null || !cells.isArray()) return null;
        
        List<JsonNode> outgoingLinks = new java.util.ArrayList<>();
        for (JsonNode cell : cells) {
            if ("standard.Link".equals(cell.path("type").asText())) {
                JsonNode source = cell.get("source");
                if (source != null && currentNodeId.equals(source.path("id").asText())) {
                    outgoingLinks.add(cell);
                }
            }
        }

        if (outgoingLinks.isEmpty()) return null;

        // Si solo hay una flecha, la seguimos sin preguntar
        if (outgoingLinks.size() == 1) {
            return outgoingLinks.get(0).path("target").path("id").asText();
        }

        // Si hay varias (decisión), buscamos coincidencia de etiqueta
        for (JsonNode link : outgoingLinks) {
            JsonNode labels = link.get("labels");
            if (labels != null && labels.isArray() && labels.size() > 0) {
                String labelText = labels.get(0).path("attrs").path("text").path("text").asText().trim();
                
                if (submittedData != null) {
                    for (Object val : submittedData.values()) {
                        if (val != null && labelText.equalsIgnoreCase(val.toString())) {
                            return link.path("target").path("id").asText();
                        }
                    }
                }
            }
        }

        // Si nada coincide, tomamos la primera como fallback
        return outgoingLinks.get(0).path("target").path("id").asText();
    }

    private boolean isFinalNode(Object data, String nodeId) throws Exception {
        if (data == null || nodeId == null) return false;
        JsonNode root = objectMapper.valueToTree(data);
        JsonNode cells = root.get("cells");
        if (cells == null || !cells.isArray()) return false;

        for (JsonNode cell : cells) {
            if (nodeId.equals(cell.path("id").asText())) {
                String type = cell.path("type").asText();
                return "uml.FinalNode".equals(type) || 
                       ("standard.Circle".equals(type) && cell.has("attrs") && cell.path("attrs").path("body").path("fill").asText().isEmpty());
            }
        }
        return false;
    }
}
