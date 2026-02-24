package com.blackwolf.backend.repository;

import com.blackwolf.backend.model.DataRetentionLog;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface DataRetentionLogRepository extends JpaRepository<DataRetentionLog, String> {
    List<DataRetentionLog> findByCompanyIdOrderByRunAtDesc(String companyId);
}
