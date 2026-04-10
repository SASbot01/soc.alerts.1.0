package com.blackwolf.backend.repository;

import com.blackwolf.backend.model.IdentityEvent;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.List;

public interface IdentityEventRepository extends JpaRepository<IdentityEvent, Long> {

    Page<IdentityEvent> findByCompanyIdAndTimestampBetween(String companyId, LocalDateTime start, LocalDateTime end, Pageable pageable);

    Page<IdentityEvent> findByCompanyIdAndUsername(String companyId, String username, Pageable pageable);

    long countByCompanyIdAndEventTypeAndTimestampAfter(String companyId, String eventType, LocalDateTime after);

    List<IdentityEvent> findByCompanyIdAndUsernameAndEventTypeAndTimestampAfter(String companyId, String username, String eventType, LocalDateTime after);
}
