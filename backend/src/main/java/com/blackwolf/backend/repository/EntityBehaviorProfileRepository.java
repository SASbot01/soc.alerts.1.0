package com.blackwolf.backend.repository;

import com.blackwolf.backend.model.EntityBehaviorProfile;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface EntityBehaviorProfileRepository extends JpaRepository<EntityBehaviorProfile, String> {

    List<EntityBehaviorProfile> findByCompanyIdOrderByRiskScoreDesc(String companyId);

    Optional<EntityBehaviorProfile> findByCompanyIdAndEntityTypeAndEntityId(
            String companyId, String entityType, String entityId);

    List<EntityBehaviorProfile> findByCompanyIdAndRiskScoreGreaterThanEqual(
            String companyId, Double riskScore);
}
