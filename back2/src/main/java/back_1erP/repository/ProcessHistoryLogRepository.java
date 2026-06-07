package back_1erP.repository;

import back_1erP.model.ProcessHistoryLog;
import org.springframework.data.mongodb.repository.MongoRepository;
import java.util.List;

public interface ProcessHistoryLogRepository extends MongoRepository<ProcessHistoryLog, String> {
    List<ProcessHistoryLog> findByProcessInstanceId(String processInstanceId);
}
