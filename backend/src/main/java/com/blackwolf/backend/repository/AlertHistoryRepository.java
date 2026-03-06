package com.blackwolf.backend.repository;

import com.blackwolf.backend.model.AlertHistory;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.List;

public interface AlertHistoryRepository extends JpaRepository<AlertHistory, String> {
    List<AlertHistory> findByCompanyIdOrderBySentAtDesc(String companyId);

    long countByCompanyIdAndSentAtAfter(String companyId, LocalDateTime after);
}
