package com.blackwolf.backend.repository;

import com.blackwolf.backend.model.HoneyToken;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface HoneyTokenRepository extends JpaRepository<HoneyToken, Long> {

    List<HoneyToken> findByCompanyIdOrderByDeployedAtDesc(String companyId);

    List<HoneyToken> findByCompanyIdAndActive(String companyId, Boolean active);
}
