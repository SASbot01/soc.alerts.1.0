package com.blackwolf.backend.repository;

import com.blackwolf.backend.model.EmailSequenceJob;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.List;

public interface EmailSequenceJobRepository extends JpaRepository<EmailSequenceJob, String> {

    List<EmailSequenceJob> findByStatusAndScheduledAtBeforeOrderByScheduledAtAsc(String status, LocalDateTime before);

    List<EmailSequenceJob> findByCompanyIdOrderByScheduledAtAsc(String companyId);

    List<EmailSequenceJob> findByCompanyIdAndStatus(String companyId, String status);
}
