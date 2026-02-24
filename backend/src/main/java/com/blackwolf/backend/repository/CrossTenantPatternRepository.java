package com.blackwolf.backend.repository;

import com.blackwolf.backend.model.CrossTenantPattern;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface CrossTenantPatternRepository extends JpaRepository<CrossTenantPattern, String> {

    List<CrossTenantPattern> findByIsActiveTrueOrderByConfidenceDesc();

    List<CrossTenantPattern> findByPatternTypeAndIsActiveTrue(String patternType);

    List<CrossTenantPattern> findByConfidenceGreaterThanEqualAndIsActiveTrue(Double minConfidence);
}
