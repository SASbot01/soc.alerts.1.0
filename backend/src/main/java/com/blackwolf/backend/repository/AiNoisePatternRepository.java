package com.blackwolf.backend.repository;

import com.blackwolf.backend.model.AiNoisePattern;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface AiNoisePatternRepository extends JpaRepository<AiNoisePattern, String> {

    List<AiNoisePattern> findByCompanyIdAndIsActiveTrue(String companyId);

    List<AiNoisePattern> findByCompanyIdOrderByCreatedAtDesc(String companyId);

    List<AiNoisePattern> findByCompanyIdAndSrcIpAndIsActiveTrue(String companyId, String srcIp);

    List<AiNoisePattern> findByCompanyIdAndThreatTypeAndIsActiveTrue(String companyId, String threatType);
}
