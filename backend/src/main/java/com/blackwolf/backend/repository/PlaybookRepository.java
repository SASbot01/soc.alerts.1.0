package com.blackwolf.backend.repository;

import com.blackwolf.backend.model.Playbook;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface PlaybookRepository extends JpaRepository<Playbook, String> {
    List<Playbook> findByCompanyId(String companyId);
    List<Playbook> findByCompanyIdAndIsActiveTrue(String companyId);
    List<Playbook> findByTriggerTypeAndIsActiveTrue(Playbook.TriggerType triggerType);
    List<Playbook> findByIsTemplateTrue();
    Optional<Playbook> findByCompanyIdAndSourceTemplateId(String companyId, String sourceTemplateId);
}
