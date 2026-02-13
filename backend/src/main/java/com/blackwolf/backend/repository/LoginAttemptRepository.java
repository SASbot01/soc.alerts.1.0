package com.blackwolf.backend.repository;

import com.blackwolf.backend.model.LoginAttempt;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import java.time.LocalDateTime;

public interface LoginAttemptRepository extends JpaRepository<LoginAttempt, Long> {

    long countByIdentifierAndAttemptTypeAndSuccessFalseAndAttemptedAtAfter(
            String identifier, LoginAttempt.AttemptType attemptType, LocalDateTime after);

    long countByIpAddressAndAttemptTypeAndSuccessFalseAndAttemptedAtAfter(
            String ipAddress, LoginAttempt.AttemptType attemptType, LocalDateTime after);

    @Modifying
    @Query("DELETE FROM LoginAttempt l WHERE l.attemptedAt < :before")
    void deleteOlderThan(LocalDateTime before);
}
