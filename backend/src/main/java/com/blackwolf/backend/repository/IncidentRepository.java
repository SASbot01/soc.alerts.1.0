package com.blackwolf.backend.repository;

import com.blackwolf.backend.model.Incident;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface IncidentRepository extends JpaRepository<Incident, String> {
    List<Incident> findByCompanyId(String companyId);
    List<Incident> findByCompanyIdAndStatus(String companyId, String status);
    long countByCompanyId(String companyId);
    long countByCompanyIdAndStatus(String companyId, String status);

    @Query("SELECT i FROM Incident i WHERE i.companyId = :companyId AND i.status = 'open' " +
           "AND i.sourceThreatId IN (SELECT t.id FROM ThreatEvent t WHERE t.srcIp = :srcIp) " +
           "ORDER BY i.createdAt DESC")
    List<Incident> findOpenBySourceIp(@Param("companyId") String companyId, @Param("srcIp") String srcIp);

    long countByCompanyIdAndCreatedAtAfter(String companyId, LocalDateTime after);

    long countByCompanyIdAndStatusAndUpdatedAtAfter(String companyId, String status, LocalDateTime after);
}
