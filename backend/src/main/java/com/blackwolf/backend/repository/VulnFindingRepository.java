package com.blackwolf.backend.repository;

import com.blackwolf.backend.model.VulnFinding;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface VulnFindingRepository extends JpaRepository<VulnFinding, Long> {

    List<VulnFinding> findByScanIdOrderByCvssScoreDesc(Long scanId);

    List<VulnFinding> findByScanIdAndStatus(Long scanId, String status);

    long countByScanIdAndSeverity(Long scanId, String severity);
}
