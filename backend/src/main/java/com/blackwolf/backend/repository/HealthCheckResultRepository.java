package com.blackwolf.backend.repository;

import com.blackwolf.backend.model.HealthCheckResult;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface HealthCheckResultRepository extends JpaRepository<HealthCheckResult, String> {

    List<HealthCheckResult> findByCompanyIdOrderByCheckedAtDesc(String companyId);

    @Query("SELECT r FROM HealthCheckResult r WHERE r.targetId = ?1 ORDER BY r.checkedAt DESC")
    List<HealthCheckResult> findByTargetIdOrderByCheckedAtDesc(String targetId);

    @Query("SELECT r FROM HealthCheckResult r WHERE r.targetId = ?1 ORDER BY r.checkedAt DESC LIMIT 1")
    Optional<HealthCheckResult> findLatestByTargetId(String targetId);

    @Query("SELECT r FROM HealthCheckResult r WHERE r.companyId = ?1 AND r.checkedAt >= ?2 ORDER BY r.checkedAt DESC")
    List<HealthCheckResult> findRecentByCompanyId(String companyId, LocalDateTime since);

    long countByCompanyIdAndStatus(String companyId, String status);
}
