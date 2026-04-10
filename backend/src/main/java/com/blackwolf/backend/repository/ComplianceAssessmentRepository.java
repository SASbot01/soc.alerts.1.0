package com.blackwolf.backend.repository;

import com.blackwolf.backend.model.ComplianceAssessment;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ComplianceAssessmentRepository extends JpaRepository<ComplianceAssessment, Long> {

    List<ComplianceAssessment> findByCompanyIdOrderByStartedAtDesc(String companyId);

    List<ComplianceAssessment> findByFrameworkIdOrderByStartedAtDesc(Long frameworkId);
}
