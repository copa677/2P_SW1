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
@RequestMapping("/api/v1/process")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class ProcessController {
    private final ProcessService processService;

    @PostMapping("/start/{projectId}")
    @PreAuthorize("hasAuthority('procesos:iniciar') or hasRole('ADMIN') or hasRole('FUNCIONARIO')")
    public ResponseEntity<ProcessInstance> start(@PathVariable String projectId, 
                                               @AuthenticationPrincipal User currentUser) {
        try {
            return ResponseEntity.ok(processService.startProcess(projectId, currentUser.getId(), currentUser.getNombres()));
        } catch (Exception e) {
            return ResponseEntity.badRequest().build();
        }
    }

    @PostMapping("/{instanceId}/advance")
    @PreAuthorize("hasAuthority('procesos:avanzar') or hasRole('ADMIN') or hasRole('FUNCIONARIO')")
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
    @PreAuthorize("hasAuthority('procesos:leer') or isAuthenticated()")
    public ResponseEntity<List<ProcessInstance>> getMyProcesses(@AuthenticationPrincipal User currentUser) {
        return ResponseEntity.ok(processService.getInstancesByInitiator(currentUser.getId()));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('procesos:leer') or isAuthenticated()")
    public ResponseEntity<ProcessInstance> getProcessById(@PathVariable String id) {
        return processService.getProcessById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }
}
