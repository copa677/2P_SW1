package back_1erP.repository;

import back_1erP.model.FlowAssignment;
import org.springframework.data.mongodb.repository.MongoRepository;
import java.util.Optional;

public interface FlowAssignmentRepository extends MongoRepository<FlowAssignment, String> {
    Optional<FlowAssignment> findByProjectId(String projectId);
}
