package back_1erP.controller;

import back_1erP.service.IAIntegrationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/dashboard")
@RequiredArgsConstructor
public class IADashboardController {

    private final IAIntegrationService iaIntegrationService;

    /**
     * Retorna las métricas consolidadas del Autoencoder de anomalías y la clasificación de textos.
     */
    @GetMapping("/ia-metrics")
    public ResponseEntity<Map<String, Object>> getIAMetrics(
            @RequestParam String projectId,
            @RequestParam(required = false) String prompt) {
        Map<String, Object> metrics = new HashMap<>();
        
        Map<String, Object> anomaliesData = iaIntegrationService.getDLAnomalies(projectId, prompt);
        List<Map<String, Object>> anomalies = (List<Map<String, Object>>) anomaliesData.get("anomalies");
        String explanation = (String) anomaliesData.get("explanation");
        
        List<Map<String, Object>> classifications = iaIntegrationService.getTextsClassification(projectId);
        
        metrics.put("anomalies", anomalies != null ? anomalies : java.util.Collections.emptyList());
        metrics.put("explanation", explanation != null ? explanation : "");
        metrics.put("classifications", classifications);
        
        // Calcular métricas agrupadas para simplificar los KPIs del dashboard
        long totalTasks = anomalies != null ? anomalies.size() : 0;
        long anomalousTasks = anomalies != null ? anomalies.stream().filter(a -> Boolean.TRUE.equals(a.get("isAnomaly"))).count() : 0;
        double anomalyRate = totalTasks > 0 ? (anomalousTasks * 100.0 / totalTasks) : 0.0;
        
        metrics.put("totalTasks", totalTasks);
        metrics.put("anomalousTasks", anomalousTasks);
        metrics.put("anomalyRate", anomalyRate);

        return ResponseEntity.ok(metrics);
    }

    /**
     * Endpoint para gatillar el entrenamiento manual de los modelos neuronales con el historial actual.
     */
    @PostMapping("/ia-train")
    public ResponseEntity<Map<String, Object>> trainModels(@RequestParam String projectId) {
        Map<String, Object> result = iaIntegrationService.trainDLModels(projectId);
        return ResponseEntity.ok(result);
    }

    /**
     * Descarga el reporte PDF dinámico generado por FastAPI.
     */
    @GetMapping("/ia-report/{projectId}")
    public ResponseEntity<byte[]> downloadReport(
            @PathVariable String projectId,
            @RequestParam(required = false) String prompt) {
        byte[] pdfBytes = iaIntegrationService.downloadPDFReport(projectId, prompt);
        if (pdfBytes == null || pdfBytes.length == 0) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_PDF);
        headers.setContentDispositionFormData("attachment", "reporte_IA_" + projectId + ".pdf");
        headers.setCacheControl("must-revalidate, post-check=0, pre-check=0");

        return new ResponseEntity<>(pdfBytes, headers, HttpStatus.OK);
    }
}
