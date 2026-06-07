package back_1erP.service;

import back_1erP.model.FlowAssignment;
import back_1erP.repository.FlowAssignmentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import java.time.LocalDateTime;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class FlowAssignmentService {

    private final FlowAssignmentRepository flowAssignmentRepository;

    public Optional<FlowAssignment> getAssignmentByProjectId(String projectId) {
        return flowAssignmentRepository.findByProjectId(projectId);
    }

    public FlowAssignment saveOrUpdateAssignment(FlowAssignment flowAssignment) {
        return flowAssignmentRepository.findByProjectId(flowAssignment.getProjectId())
                .map(existing -> {
                    existing.setAssignments(flowAssignment.getAssignments());
                    existing.setProjectName(flowAssignment.getProjectName());
                    existing.setConfiguredBy(flowAssignment.getConfiguredBy());
                    existing.setUpdatedAt(LocalDateTime.now());
                    return flowAssignmentRepository.save(existing);
                })
                .orElseGet(() -> {
                    flowAssignment.setUpdatedAt(LocalDateTime.now());
                    return flowAssignmentRepository.save(flowAssignment);
                });
    }
}
