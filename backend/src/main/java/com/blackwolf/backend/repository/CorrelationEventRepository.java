package com.blackwolf.backend.repository;

import com.blackwolf.backend.model.CorrelationEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;

public interface CorrelationEventRepository extends JpaRepository<CorrelationEvent, String> {
    List<CorrelationEvent> findByCompanyIdOrderByMatchedAtDesc(String companyId);
    List<CorrelationEvent> findByIncidentId(String incidentId);

    @Query("SELECT COUNT(ce) FROM CorrelationEvent ce WHERE ce.companyId = :companyId " +
           "AND ce.ruleId = :ruleId AND ce.matchedAt >= :since")
    long countRecentByRule(@Param("companyId") String companyId,
                           @Param("ruleId") String ruleId,
                           @Param("since") LocalDateTime since);
}
