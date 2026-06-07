package back_1erP.controller;

import back_1erP.model.FlowAssignment;
import back_1erP.service.FlowAssignmentService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/flow-assignments")
@RequiredArgsConstructor
public class FlowAssignmentController {

    private final FlowAssignmentService flowAssignmentService;

    @GetMapping("/project/{projectId}")
    public ResponseEntity<FlowAssignment> getAssignmentByProjectId(@PathVariable String projectId) {
        return flowAssignmentService.getAssignmentByProjectId(projectId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public ResponseEntity<FlowAssignment> saveOrUpdateAssignment(@RequestBody FlowAssignment flowAssignment) {
        return ResponseEntity.ok(flowAssignmentService.saveOrUpdateAssignment(flowAssignment));
    }
}
