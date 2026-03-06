package com.blackwolf.backend.repository;

import com.blackwolf.backend.model.BackupStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.time.LocalDateTime;
import java.util.List;

public interface BackupStatusRepository extends JpaRepository<BackupStatus, String> {

    List<BackupStatus> findByCompanyIdOrderByReportedAtDesc(String companyId);

    @Query("SELECT b FROM BackupStatus b WHERE b.companyId = ?1 AND b.reportedAt >= ?2 ORDER BY b.reportedAt DESC")
    List<BackupStatus> findRecentByCompanyId(String companyId, LocalDateTime since);

    @Query("SELECT b FROM BackupStatus b WHERE b.companyId = ?1 AND b.clientHost = ?2 AND b.jobName = ?3 ORDER BY b.reportedAt DESC")
    List<BackupStatus> findByHostAndJob(String companyId, String clientHost, String jobName);

    @Query("SELECT DISTINCT b.clientHost FROM BackupStatus b WHERE b.companyId = ?1")
    List<String> findDistinctHostsByCompanyId(String companyId);

    @Query("SELECT b FROM BackupStatus b WHERE b.companyId = ?1 AND b.status = 'FAILED' AND b.reportedAt >= ?2")
    List<BackupStatus> findFailedSince(String companyId, LocalDateTime since);

    long countByCompanyIdAndStatus(String companyId, String status);
}
