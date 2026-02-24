package com.blackwolf.backend.repository;

import com.blackwolf.backend.model.SigmaRule;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface SigmaRuleRepository extends JpaRepository<SigmaRule, String> {

    List<SigmaRule> findByCompanyIdOrderByUpdatedAtDesc(String companyId);

    @Query("SELECT s FROM SigmaRule s WHERE s.isEnabled = true AND (s.companyId = :companyId OR s.companyId IS NULL)")
    List<SigmaRule> findEnabledByCompanyId(String companyId);

    List<SigmaRule> findByIsEnabledTrue();

    List<SigmaRule> findByCompanyIdIsNullOrderByTitleAsc();

    List<SigmaRule> findBySourceOrderByTitleAsc(String source);

    long countByCompanyId(String companyId);
}
