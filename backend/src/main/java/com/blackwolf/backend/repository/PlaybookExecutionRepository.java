package com.blackwolf.backend.repository;

import com.blackwolf.backend.model.PlaybookExecution;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PlaybookExecutionRepository extends JpaRepository<PlaybookExecution, String> {
    List<PlaybookExecution> findByCompanyIdOrderByStartedAtDesc(String companyId);
    List<PlaybookExecution> findByPlaybookIdOrderByStartedAtDesc(String playbookId);
}
