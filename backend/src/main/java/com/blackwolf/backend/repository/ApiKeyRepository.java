package com.blackwolf.backend.repository;

import com.blackwolf.backend.model.ApiKey;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ApiKeyRepository extends JpaRepository<ApiKey, String> {
    List<ApiKey> findByCompanyIdOrderByCreatedAtDesc(String companyId);

    Optional<ApiKey> findByKeyHash(String keyHash);

    long countByCompanyIdAndIsActiveTrue(String companyId);
}
