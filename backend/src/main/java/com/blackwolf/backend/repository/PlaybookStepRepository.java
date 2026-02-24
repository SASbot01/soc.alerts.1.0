package com.blackwolf.backend.repository;

import com.blackwolf.backend.model.PlaybookStep;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PlaybookStepRepository extends JpaRepository<PlaybookStep, String> {
    List<PlaybookStep> findByPlaybookIdOrderByStepOrderAsc(String playbookId);
    void deleteByPlaybookId(String playbookId);
}
