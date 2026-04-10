package com.blackwolf.backend.repository;

import com.blackwolf.backend.model.ComplianceResult;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ComplianceResultRepository extends JpaRepository<ComplianceResult, Long> {

    List<ComplianceResult> findByAssessmentId(Long assessmentId);

    long countByAssessmentIdAndStatus(Long assessmentId, String status);
}
