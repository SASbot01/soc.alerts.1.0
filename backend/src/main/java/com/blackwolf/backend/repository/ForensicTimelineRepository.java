package com.blackwolf.backend.repository;

import com.blackwolf.backend.model.ForensicTimeline;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ForensicTimelineRepository extends JpaRepository<ForensicTimeline, Long> {

    List<ForensicTimeline> findByCaseIdOrderByTimestampAsc(Long caseId);
}
