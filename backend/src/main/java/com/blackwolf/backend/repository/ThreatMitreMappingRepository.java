package com.blackwolf.backend.repository;

import com.blackwolf.backend.model.ThreatMitreMapping;
import com.blackwolf.backend.model.ThreatMitreMappingId;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ThreatMitreMappingRepository extends JpaRepository<ThreatMitreMapping, ThreatMitreMappingId> {
    List<ThreatMitreMapping> findByThreatEventId(String threatEventId);
}
