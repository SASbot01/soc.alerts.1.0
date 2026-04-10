package com.blackwolf.backend.repository;

import com.blackwolf.backend.model.ComplianceFramework;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ComplianceFrameworkRepository extends JpaRepository<ComplianceFramework, Long> {

    List<ComplianceFramework> findByCompanyIdOrderByNameAsc(String companyId);

    List<ComplianceFramework> findByCompanyIdAndEnabled(String companyId, Boolean enabled);
}
