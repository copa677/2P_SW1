package back_1erP.service;

import back_1erP.model.ProcessInstance;
import back_1erP.model.Project;
import back_1erP.model.TaskInstance;
import back_1erP.model.ProcessHistoryLog;
import back_1erP.model.FlowAssignment;
import back_1erP.model.Role;
import back_1erP.repository.ProcessRepository;
import back_1erP.repository.ProjectRepository;
import back_1erP.repository.TaskInstanceRepository;
import back_1erP.repository.ProcessHistoryLogRepository;
import back_1erP.repository.FlowAssignmentRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Random;

@Service
@RequiredArgsConstructor
public class ProcessService {
    private final ProcessRepository processRepository;
    private final ProjectRepository projectRepository;
    private final NotificationService notificationService;
    private final TaskInstanceRepository taskInstanceRepository;
    private final ProcessHistoryLogRepository processHistoryLogRepository;
    private final FlowAssignmentRepository flowAssignmentRepository;
    private final ObjectMapper objectMapper = new ObjectMapper();

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
        
        // Guardar la cabecera
        ProcessInstance savedInstance = processRepository.save(instance);

        // Resolver carril y asignado de la tarea inicial
        String laneId = findLaneIdOfNode(project.getData(), initialNodeId);
        String laneName = getLaneName(project.getData(), laneId);
        String assignedUserId = resolveAssignedUser(projectId, laneId, laneName, initiatorId);
        String taskName = getNodeLabel(project.getData(), initialNodeId);

        // Crear la primera tarea activa
        TaskInstance firstTask = TaskInstance.builder()
                .processInstanceId(savedInstance.getId())
                .projectId(projectId)
                .nodeId(initialNodeId)
                .nodeLabel(taskName)
                .calleId(laneId)
                .assignedUserId(assignedUserId)
                .status("PENDING")
                .createdAt(LocalDateTime.now())
                .build();
        taskInstanceRepository.save(firstTask);

        // Log de inicio en historial
        ProcessHistoryLog log = ProcessHistoryLog.builder()
                .processInstanceId(savedInstance.getId())
                .nodeId(initialNodeId)
                .nodeLabel("Inicio del Proceso")
                .completedBy(initiatorId)
                .action("START")
                .timestamp(LocalDateTime.now())
                .submittedData(new HashMap<>())
                .build();
        processHistoryLogRepository.save(log);

        // Notificar a los dispositivos móviles suscritos
        notificationService.sendPushNotification(
            savedInstance.getFcmTokens(), 
            "Actualización de Trámite", 
            "Tu trámite ha avanzado a: " + laneName
        );

        return savedInstance;
    }

    public ProcessInstance advanceProcess(String instanceId, String userId, String userName, Map<String, Object> submittedData) throws Exception {
        ProcessInstance instance = processRepository.findById(instanceId)
                .orElseThrow(() -> new RuntimeException("Instancia no encontrada"));

        Project project = projectRepository.findById(instance.getProjectId())
                .orElseThrow(() -> new RuntimeException("Proyecto no encontrado"));

        // Identificar qué tarea activa se está completando
        String taskId = submittedData != null ? (String) submittedData.get("taskId") : null;
        TaskInstance activeTask = null;
        if (taskId != null) {
            activeTask = taskInstanceRepository.findById(taskId).orElse(null);
        }
        if (activeTask == null) {
            List<TaskInstance> pending = taskInstanceRepository.findByProcessInstanceIdAndStatus(instanceId, "PENDING");
            if (pending.isEmpty()) {
                throw new RuntimeException("No hay tareas activas para esta instancia");
            }
            activeTask = pending.stream()
                .filter(t -> userId.equals(t.getAssignedUserId()))
                .findFirst()
                .orElse(pending.get(0));
        }

        String currentNodeId = activeTask.getNodeId();

        // Guardar datos en el expediente
        if (submittedData != null) {
            Map<String, Object> cleanedData = new HashMap<>(submittedData);
            cleanedData.remove("taskId");
            instance.getData().putAll(cleanedData);
            processRepository.save(instance);
        }

        // Registrar en historial
        ProcessHistoryLog log = ProcessHistoryLog.builder()
                .processInstanceId(instanceId)
                .nodeId(currentNodeId)
                .nodeLabel(activeTask.getNodeLabel())
                .completedBy(userId)
                .action("COMPLETE")
                .timestamp(LocalDateTime.now())
                .submittedData(submittedData != null ? new HashMap<>(submittedData) : new HashMap<>())
                .build();
        log.getSubmittedData().remove("taskId");
        processHistoryLogRepository.save(log);

        // Marcar la tarea actual como completada
        activeTask.setStatus("COMPLETED");
        taskInstanceRepository.save(activeTask);

        // Buscar el siguiente nodo en el JSON
        String nextNodeId = findNextNode(project.getData(), currentNodeId, submittedData);

        if (nextNodeId == null || isFinalNode(project.getData(), nextNodeId)) {
            instance.setStatus("COMPLETED");
            instance.setEndDate(LocalDateTime.now());
            processRepository.save(instance);

            // Cancelar otras tareas pendientes de esta instancia
            List<TaskInstance> remainingTasks = taskInstanceRepository.findByProcessInstanceIdAndStatus(instanceId, "PENDING");
            for (TaskInstance t : remainingTasks) {
                t.setStatus("CANCELLED");
                taskInstanceRepository.save(t);
            }
        } else {
            // Resolver carril y asignado de la siguiente tarea
            String nextLaneId = findLaneIdOfNode(project.getData(), nextNodeId);
            String nextLaneName = getLaneName(project.getData(), nextLaneId);
            String nextAssignedUserId = resolveAssignedUser(instance.getProjectId(), nextLaneId, nextLaneName, instance.getInitiatorId());
            String nextTaskName = getNodeLabel(project.getData(), nextNodeId);

            // Crear la siguiente tarea activa
            TaskInstance nextTask = TaskInstance.builder()
                    .processInstanceId(instanceId)
                    .projectId(instance.getProjectId())
                    .nodeId(nextNodeId)
                    .nodeLabel(nextTaskName)
                    .calleId(nextLaneId)
                    .assignedUserId(nextAssignedUserId)
                    .status("PENDING")
                    .createdAt(LocalDateTime.now())
                    .build();
            taskInstanceRepository.save(nextTask);
        }

        // Notificar a los dispositivos móviles
        String body = instance.getStatus().equals("COMPLETED") 
            ? "¡Tu trámite ha finalizado con éxito!" 
            : "Tu trámite ha avanzado a un nuevo paso.";
            
        notificationService.sendPushNotification(
            instance.getFcmTokens(),
            "Actualización de Trámite",
            body
        );

        return instance;
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
        
        // Formato estructurado nuevo (Opción B)
        if (root.has("elementos") && root.get("elementos").isArray()) {
            for (JsonNode elem : root.get("elementos")) {
                if ("start".equals(elem.path("tipo").asText())) {
                    return elem.path("id").asText();
                }
            }
            return null;
        }
        
        // Fallback al formato plano anterior de JointJS
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
        
        // Formato estructurado nuevo (Opción B)
        if (root.has("enlaces") && root.get("enlaces").isArray()) {
            List<JsonNode> outgoing = new java.util.ArrayList<>();
            for (JsonNode link : root.get("enlaces")) {
                if (currentNodeId.equals(link.path("origen").path("elementoId").asText())) {
                    outgoing.add(link);
                }
            }
            if (outgoing.isEmpty()) return null;
            if (outgoing.size() == 1) {
                return outgoing.get(0).path("destino").path("elementoId").asText();
            }
            for (JsonNode link : outgoing) {
                String cond = link.path("condicion").asText().trim();
                if (submittedData != null) {
                    for (Object val : submittedData.values()) {
                        if (val != null && cond.equalsIgnoreCase(val.toString())) {
                            return link.path("destino").path("elementoId").asText();
                        }
                    }
                }
            }
            return outgoing.get(0).path("destino").path("elementoId").asText();
        }
        
        // Fallback al formato plano anterior de JointJS
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
        
        // Formato estructurado nuevo (Opción B)
        if (root.has("elementos") && root.get("elementos").isArray()) {
            for (JsonNode elem : root.get("elementos")) {
                if (nodeId.equals(elem.path("id").asText())) {
                    return "end".equals(elem.path("tipo").asText());
                }
            }
            return false;
        }
        
        // Fallback al formato plano anterior de JointJS
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

    private String findLaneIdOfNode(Object data, String nodeId) {
        if (data == null || nodeId == null) return null;
        JsonNode root = objectMapper.valueToTree(data);
        if (root.has("elementos") && root.get("elementos").isArray()) {
            for (JsonNode elem : root.get("elementos")) {
                if (nodeId.equals(elem.path("id").asText())) {
                    return elem.path("calleId").asText(null);
                }
            }
        }
        return null;
    }

    private String getLaneName(Object data, String laneId) {
        if (data == null || laneId == null) return "Calle";
        JsonNode root = objectMapper.valueToTree(data);
        if (root.has("calles") && root.get("calles").isArray()) {
            for (JsonNode lane : root.get("calles")) {
                if (laneId.equals(lane.path("id").asText())) {
                    return lane.path("nombre").asText("Calle");
                }
            }
        }
        return "Calle";
    }

    private String getNodeLabel(Object data, String nodeId) {
        if (data == null || nodeId == null) return "Actividad";
        JsonNode root = objectMapper.valueToTree(data);
        if (root.has("elementos") && root.get("elementos").isArray()) {
            for (JsonNode elem : root.get("elementos")) {
                if (nodeId.equals(elem.path("id").asText())) {
                    return elem.path("nombre").asText("Actividad");
                }
            }
        }
        return "Actividad";
    }

    private String resolveAssignedUser(String projectId, String laneId, String laneName, String initiatorId) {
        if (laneName != null && (laneName.equalsIgnoreCase("Cliente") || laneName.equalsIgnoreCase("Clientes"))) {
            return initiatorId;
        }
        return flowAssignmentRepository.findByProjectId(projectId)
                .flatMap(flowAssignment -> flowAssignment.getAssignments().stream()
                        .filter(assign -> laneId.equals(assign.getCalleId()))
                        .map(FlowAssignment.LaneAssignment::getAssignedUserId)
                        .findFirst())
                .orElse(null);
    }

    public Optional<ProcessInstance> getProcessById(String id) {
        return processRepository.findById(id);
    }

    public Optional<ProcessInstance> getProcessByTrackingCode(String code) {
        return processRepository.findByTrackingCode(code);
    }

    public boolean addFcmTokenToProcess(String code, String token) {
        return processRepository.findByTrackingCode(code).map(instance -> {
            if (!instance.getFcmTokens().contains(token)) {
                instance.getFcmTokens().add(token);
                processRepository.save(instance);
            }
            return true;
        }).orElse(false);
    }
}

