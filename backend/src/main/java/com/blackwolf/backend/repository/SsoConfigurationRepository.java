package com.blackwolf.backend.repository;

import com.blackwolf.backend.model.SsoConfiguration;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface SsoConfigurationRepository extends JpaRepository<SsoConfiguration, String> {

    Optional<SsoConfiguration> findByCompanyId(String companyId);

    Optional<SsoConfiguration> findByCompanyIdAndIsActiveTrue(String companyId);
}
