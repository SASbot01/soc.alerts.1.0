package com.blackwolf.backend.repository;

import com.blackwolf.backend.model.BlockedSubnet;
import com.blackwolf.backend.model.BlockedSubnetId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;

public interface BlockedSubnetRepository extends JpaRepository<BlockedSubnet, BlockedSubnetId> {

    @Query("SELECT b FROM BlockedSubnet b WHERE b.companyId = :companyId AND (b.expiresAt IS NULL OR b.expiresAt > :now)")
    List<BlockedSubnet> findActiveByCompanyId(@Param("companyId") String companyId, @Param("now") LocalDateTime now);

    boolean existsByCompanyIdAndCidr(String companyId, String cidr);
}
