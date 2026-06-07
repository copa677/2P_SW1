package back_1erP.controller;

import back_1erP.model.TaskInstance;
import back_1erP.model.User;
import back_1erP.repository.TaskInstanceRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/v1/tasks")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class TaskInstanceController {

    private final TaskInstanceRepository taskInstanceRepository;

    @GetMapping("/my-pending")
    public ResponseEntity<List<TaskInstance>> getMyPendingTasks(@AuthenticationPrincipal User currentUser) {
        if (currentUser == null) {
            return ResponseEntity.status(401).build();
        }
        List<TaskInstance> pendingTasks = taskInstanceRepository.findByAssignedUserIdAndStatus(currentUser.getId(), "PENDING");
        return ResponseEntity.ok(pendingTasks);
    }

    @GetMapping("/{id}")
    public ResponseEntity<TaskInstance> getTaskById(@PathVariable String id) {
        return taskInstanceRepository.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }
}
