package back_1erP.repository;

import back_1erP.model.TaskInstance;
import org.springframework.data.mongodb.repository.MongoRepository;
import java.util.List;

public interface TaskInstanceRepository extends MongoRepository<TaskInstance, String> {
    List<TaskInstance> findByProcessInstanceId(String processInstanceId);
    List<TaskInstance> findByAssignedUserIdAndStatus(String assignedUserId, String status);
    List<TaskInstance> findByProcessInstanceIdAndStatus(String processInstanceId, String status);
}
