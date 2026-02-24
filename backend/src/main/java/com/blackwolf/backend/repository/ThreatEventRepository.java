package com.blackwolf.backend.repository;

import com.blackwolf.backend.model.ThreatEvent;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;

public interface ThreatEventRepository extends JpaRepository<ThreatEvent, String>, JpaSpecificationExecutor<ThreatEvent> {
    List<ThreatEvent> findByCompanyId(String companyId, Pageable pageable);

    List<ThreatEvent> findByCompanyId(String companyId);

    long countByCompanyId(String companyId);

    long countByCompanyIdAndTimestampAfter(String companyId, LocalDateTime timestamp);

    @Query("SELECT t.srcIp, COUNT(t), MAX(t.severity), MIN(t.threatType) " +
           "FROM ThreatEvent t WHERE t.companyId = :companyId AND t.srcIp IS NOT NULL " +
           "GROUP BY t.srcIp")
    List<Object[]> findMapOriginsByCompanyId(@Param("companyId") String companyId);

    @Query("SELECT COUNT(t) FROM ThreatEvent t WHERE t.companyId = :companyId " +
           "AND t.srcIp = :srcIp AND t.threatType = :threatType " +
           "AND t.timestamp >= :since")
    long countRecentDuplicates(@Param("companyId") String companyId,
                                @Param("srcIp") String srcIp,
                                @Param("threatType") String threatType,
                                @Param("since") LocalDateTime since);

    @Query("SELECT t.srcIp, COUNT(DISTINCT t.companyId), COUNT(t) " +
           "FROM ThreatEvent t WHERE t.timestamp >= :since AND t.srcIp IS NOT NULL " +
           "GROUP BY t.srcIp HAVING COUNT(DISTINCT t.companyId) >= 2 " +
           "ORDER BY COUNT(DISTINCT t.companyId) DESC")
    List<Object[]> findCrossTenantAttackers(@Param("since") LocalDateTime since);

    List<ThreatEvent> findByCompanyIdAndTimestampAfterOrderByTimestampDesc(String companyId, LocalDateTime since);
}
