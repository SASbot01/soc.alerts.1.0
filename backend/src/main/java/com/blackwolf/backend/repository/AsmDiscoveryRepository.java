package com.blackwolf.backend.repository;

import com.blackwolf.backend.model.AsmDiscovery;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface AsmDiscoveryRepository extends JpaRepository<AsmDiscovery, Long> {

    List<AsmDiscovery> findByDomainIdOrderByFirstSeenDesc(Long domainId);

    long countByDomainIdAndRiskLevel(Long domainId, String riskLevel);
}
