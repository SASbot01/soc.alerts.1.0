package com.blackwolf.backend.repository;

import com.blackwolf.backend.model.AiLearningEvent;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.List;

public interface AiLearningEventRepository extends JpaRepository<AiLearningEvent, String> {

    List<AiLearningEvent> findByCompanyIdOrderByLearnedAtDesc(String companyId);

    List<AiLearningEvent> findByEventTypeAndLearnedAtAfter(String eventType, LocalDateTime after);

    List<AiLearningEvent> findByCompanyIdAndEventType(String companyId, String eventType);

    long countByCompanyIdAndEventType(String companyId, String eventType);

    long countByEventTypeAndLearnedAtAfter(String eventType, LocalDateTime after);
}
