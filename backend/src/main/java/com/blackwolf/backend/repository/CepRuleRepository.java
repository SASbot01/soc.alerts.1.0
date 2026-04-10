package com.blackwolf.backend.repository;

import com.blackwolf.backend.model.CepRule;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface CepRuleRepository extends JpaRepository<CepRule, Long> {

    List<CepRule> findByCompanyIdOrderByCreatedAtDesc(String companyId);

    List<CepRule> findByCompanyIdAndEnabled(String companyId, Boolean enabled);
}
