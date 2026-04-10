package com.blackwolf.backend.repository;

import com.blackwolf.backend.model.CloudFinding;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface CloudFindingRepository extends JpaRepository<CloudFinding, Long> {

    List<CloudFinding> findByAccountIdOrderByFoundAtDesc(Long accountId);

    List<CloudFinding> findByAccountIdAndStatus(Long accountId, String status);

    long countByAccountIdAndSeverity(Long accountId, String severity);
}
