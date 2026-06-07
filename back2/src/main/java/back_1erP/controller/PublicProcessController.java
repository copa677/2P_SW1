package back_1erP.controller;

import back_1erP.model.ProcessInstance;
import back_1erP.service.ProcessService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Optional;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/public/process")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class PublicProcessController {

    private final ProcessService processService;

    @GetMapping("/track/{code}")
    public ResponseEntity<ProcessInstance> trackProcess(@PathVariable String code) {
        return processService.getProcessByTrackingCode(code)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/subscribe/{code}")
    public ResponseEntity<Map<String, String>> subscribeToProcess(
            @PathVariable String code,
            @RequestBody Map<String, String> request) {
        
        String token = request.get("token");
        if (token == null || token.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "FCM Token is required"));
        }

        boolean success = processService.addFcmTokenToProcess(code, token);
        if (success) {
            return ResponseEntity.ok(Map.of("message", "Subscribed successfully to process " + code));
        } else {
            return ResponseEntity.notFound().build();
        }
    }
}
