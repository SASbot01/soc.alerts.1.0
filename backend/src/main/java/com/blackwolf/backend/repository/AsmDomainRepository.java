package com.blackwolf.backend.repository;

import com.blackwolf.backend.model.AsmDomain;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface AsmDomainRepository extends JpaRepository<AsmDomain, Long> {

    List<AsmDomain> findByCompanyIdOrderByDiscoveredAtDesc(String companyId);
}
