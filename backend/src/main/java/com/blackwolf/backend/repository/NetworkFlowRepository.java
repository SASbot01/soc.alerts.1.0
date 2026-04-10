package com.blackwolf.backend.repository;

import com.blackwolf.backend.model.NetworkFlow;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;

public interface NetworkFlowRepository extends JpaRepository<NetworkFlow, Long> {

    Page<NetworkFlow> findByCompanyIdAndTimestampBetween(String companyId, LocalDateTime start, LocalDateTime end, Pageable pageable);

    Page<NetworkFlow> findByCompanyIdAndThreatTypeNotNull(String companyId, Pageable pageable);
}
