package com.blackwolf.backend.repository;

import com.blackwolf.backend.model.Prospect;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface ProspectRepository extends JpaRepository<Prospect, String> {

    Optional<Prospect> findByEmail(String email);

    List<Prospect> findByStatusOrderByCreatedAtDesc(String status);

    List<Prospect> findByStatusAndNextEmailAtBeforeOrderByNextEmailAtAsc(String status, LocalDateTime before);

    List<Prospect> findByStatusInAndNextEmailAtBeforeOrderByScoreDesc(List<String> statuses, LocalDateTime before);

    long countByStatus(String status);

    long countBySource(String source);

    long countByStatusAndCreatedAtAfter(String status, LocalDateTime after);

    List<Prospect> findAllByOrderByCreatedAtDesc();

    List<Prospect> findByScoreGreaterThanOrderByScoreDesc(double minScore);
}
