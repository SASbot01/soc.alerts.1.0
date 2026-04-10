package com.blackwolf.backend.repository;

import com.blackwolf.backend.model.VulnScan;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface VulnScanRepository extends JpaRepository<VulnScan, Long> {

    List<VulnScan> findByCompanyIdOrderByStartedAtDesc(String companyId);
}
