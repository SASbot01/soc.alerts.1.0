package com.blackwolf.backend.repository;

import com.blackwolf.backend.model.Asset;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface AssetRepository extends JpaRepository<Asset, String> {
    List<Asset> findByCompanyId(String companyId);
    List<Asset> findByCompanyIdAndAssetType(String companyId, Asset.AssetType assetType);
    List<Asset> findByCompanyIdAndCriticality(String companyId, Asset.Criticality criticality);
    Optional<Asset> findByIpAddressAndCompanyId(String ipAddress, String companyId);
    List<Asset> findByIpAddressInAndCompanyId(List<String> ipAddresses, String companyId);
    long countByCompanyIdAndStatus(String companyId, Asset.AssetStatus status);
}
