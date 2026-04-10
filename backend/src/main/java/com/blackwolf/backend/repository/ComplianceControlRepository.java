package com.blackwolf.backend.repository;

import com.blackwolf.backend.model.ComplianceControl;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ComplianceControlRepository extends JpaRepository<ComplianceControl, Long> {

    List<ComplianceControl> findByFrameworkIdOrderByControlIdAsc(Long frameworkId);

    long countByFrameworkId(Long frameworkId);
}
