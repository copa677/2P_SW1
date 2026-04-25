package back_1erP.controller;

import back_1erP.model.ProcessInstance;
import back_1erP.model.User;
import back_1erP.service.ProcessService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/process")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class ProcessController {
    private final ProcessService processService;

    @PostMapping("/start/{projectId}")
    @PreAuthorize("hasAnyRole('ADMIN', 'FUNCIONARIO')")
    public ResponseEntity<ProcessInstance> start(@PathVariable String projectId, 
                                               @AuthenticationPrincipal User currentUser) {
        try {
            return ResponseEntity.ok(processService.startProcess(projectId, currentUser.getId(), currentUser.getNombres()));
        } catch (Exception e) {
            return ResponseEntity.badRequest().build();
        }
    }

    @PostMapping("/{instanceId}/advance")
    @PreAuthorize("hasAnyRole('ADMIN', 'FUNCIONARIO')")
    public ResponseEntity<ProcessInstance> advance(@PathVariable String instanceId,
                                                 @AuthenticationPrincipal User currentUser,
                                                 @RequestBody Map<String, Object> data) {
        try {
            return ResponseEntity.ok(processService.advanceProcess(instanceId, currentUser.getId(), currentUser.getNombres(), data));
        } catch (Exception e) {
            return ResponseEntity.badRequest().build();
        }
    }

    @GetMapping("/my-processes")
    @PreAuthorize("hasAnyRole('ADMIN', 'FUNCIONARIO')")
    public ResponseEntity<List<ProcessInstance>> getMyProcesses(@AuthenticationPrincipal User currentUser) {
        return ResponseEntity.ok(processService.getInstancesByInitiator(currentUser.getId()));
    }
}
