package com.blackwolf.backend.repository;

import com.blackwolf.backend.model.MarketplaceInstallation;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface MarketplaceInstallationRepository extends JpaRepository<MarketplaceInstallation, String> {
    List<MarketplaceInstallation> findByCompanyId(String companyId);
    Optional<MarketplaceInstallation> findByCompanyIdAndItemId(String companyId, String itemId);
    long countByItemId(String itemId);
}
