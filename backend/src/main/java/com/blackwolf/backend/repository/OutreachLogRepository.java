package com.blackwolf.backend.repository;

import com.blackwolf.backend.model.OutreachLog;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.List;

public interface OutreachLogRepository extends JpaRepository<OutreachLog, String> {

    List<OutreachLog> findByProspectIdOrderBySentAtDesc(String prospectId);

    long countByEmailTypeAndSentAtAfter(String emailType, LocalDateTime after);

    long countByStatusAndSentAtAfter(String status, LocalDateTime after);

    long countBySentAtAfter(LocalDateTime after);

    List<OutreachLog> findBySentAtAfterOrderBySentAtDesc(LocalDateTime after);
}
