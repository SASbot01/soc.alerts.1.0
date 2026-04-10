package com.blackwolf.backend.repository;

import com.blackwolf.backend.model.NormalizedLog;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;

public interface NormalizedLogRepository extends JpaRepository<NormalizedLog, Long> {

    Page<NormalizedLog> findByCompanyIdAndTimestampBetween(String companyId, LocalDateTime start, LocalDateTime end, Pageable pageable);

    long countByCompanyIdAndTimestampAfter(String companyId, LocalDateTime after);
}
