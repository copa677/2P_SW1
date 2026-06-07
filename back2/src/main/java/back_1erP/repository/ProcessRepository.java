package back_1erP.repository;

import back_1erP.model.ProcessInstance;
import org.springframework.data.mongodb.repository.MongoRepository;
import java.util.List;
import java.util.Optional;

public interface ProcessRepository extends MongoRepository<ProcessInstance, String> {
    List<ProcessInstance> findByInitiatorId(String initiatorId);
    Optional<back_1erP.model.ProcessInstance> findByTrackingCode(String trackingCode);
    List<back_1erP.model.ProcessInstance> findByProjectId(String projectId);
}
