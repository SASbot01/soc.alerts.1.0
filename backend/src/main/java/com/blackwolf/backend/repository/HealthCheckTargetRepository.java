package com.blackwolf.backend.repository;

import com.blackwolf.backend.model.HealthCheckTarget;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface HealthCheckTargetRepository extends JpaRepository<HealthCheckTarget, String> {

    List<HealthCheckTarget> findByCompanyIdOrderByCreatedAtDesc(String companyId);

    List<HealthCheckTarget> findByCompanyIdAndEnabledTrue(String companyId);
}
