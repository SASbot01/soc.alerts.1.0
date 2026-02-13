package com.blackwolf.backend.repository;

import com.blackwolf.backend.model.PlaybookExecutionLog;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PlaybookExecutionLogRepository extends JpaRepository<PlaybookExecutionLog, String> {
    List<PlaybookExecutionLog> findByExecutionIdOrderByExecutedAtAsc(String executionId);
}
