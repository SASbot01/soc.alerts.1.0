package com.blackwolf.backend.repository;

import com.blackwolf.backend.model.ThreatMitreMapping;
import com.blackwolf.backend.model.ThreatMitreMappingId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface ThreatMitreMappingRepository extends JpaRepository<ThreatMitreMapping, ThreatMitreMappingId> {
    List<ThreatMitreMapping> findByThreatEventId(String threatEventId);

    @Query("SELECT m FROM ThreatMitreMapping m JOIN ThreatEvent t ON m.threatEventId = t.id WHERE t.companyId = :companyId")
    List<ThreatMitreMapping> findByCompanyId(@Param("companyId") String companyId);
}
