package com.blackwolf.backend.repository;

import com.blackwolf.backend.model.BlockedIP;
import com.blackwolf.backend.model.BlockedIPId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;

public interface BlockedIPRepository extends JpaRepository<BlockedIP, BlockedIPId> {
    List<BlockedIP> findByCompanyId(String companyId);

    @Query("SELECT b FROM BlockedIP b WHERE b.companyId = :companyId AND (b.expiresAt IS NULL OR b.expiresAt > :now)")
    List<BlockedIP> findActiveByCompanyId(@Param("companyId") String companyId, @Param("now") LocalDateTime now);

    @Modifying
    @Query("DELETE FROM BlockedIP b WHERE b.expiresAt IS NOT NULL AND b.expiresAt < :now")
    int deleteExpired(@Param("now") LocalDateTime now);
}
