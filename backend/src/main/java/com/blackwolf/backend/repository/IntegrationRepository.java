package com.blackwolf.backend.repository;

import com.blackwolf.backend.model.Integration;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface IntegrationRepository extends JpaRepository<Integration, String> {
    List<Integration> findByCompanyIdOrderByCreatedAtDesc(String companyId);
    Optional<Integration> findByCompanyIdAndProvider(String companyId, String provider);
    List<Integration> findByCompanyIdAndIsActiveTrue(String companyId);
    List<Integration> findByCompanyIdAndCategoryAndIsActiveTrue(String companyId, String category);
}
