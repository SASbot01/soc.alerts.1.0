package com.blackwolf.backend.repository;

import com.blackwolf.backend.model.ForensicCase;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ForensicCaseRepository extends JpaRepository<ForensicCase, Long> {

    List<ForensicCase> findByCompanyIdOrderByCreatedAtDesc(String companyId);

    List<ForensicCase> findByCompanyIdAndStatus(String companyId, String status);
}
