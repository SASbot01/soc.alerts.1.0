package com.blackwolf.backend.repository;

import com.blackwolf.backend.model.AiAgentReport;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface AiAgentReportRepository extends JpaRepository<AiAgentReport, String> {
    List<AiAgentReport> findByCompanyIdOrderByCreatedAtDesc(String companyId);
    List<AiAgentReport> findByCompanyIdAndReportTypeOrderByCreatedAtDesc(String companyId, String reportType);
    Optional<AiAgentReport> findFirstByCompanyIdAndReportTypeAndStatusOrderByCreatedAtDesc(
            String companyId, String reportType, String status);
}
