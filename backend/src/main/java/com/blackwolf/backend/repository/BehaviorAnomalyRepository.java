package com.blackwolf.backend.repository;

import com.blackwolf.backend.model.BehaviorAnomaly;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface BehaviorAnomalyRepository extends JpaRepository<BehaviorAnomaly, String> {

    List<BehaviorAnomaly> findByCompanyIdOrderByDetectedAtDesc(String companyId);

    List<BehaviorAnomaly> findByProfileIdOrderByDetectedAtDesc(String profileId);

    long countByCompanyIdAndIsReviewedFalse(String companyId);
}
