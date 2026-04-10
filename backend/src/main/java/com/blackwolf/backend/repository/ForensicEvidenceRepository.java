package com.blackwolf.backend.repository;

import com.blackwolf.backend.model.ForensicEvidence;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ForensicEvidenceRepository extends JpaRepository<ForensicEvidence, Long> {

    List<ForensicEvidence> findByCaseIdOrderByCollectedAtDesc(Long caseId);
}
