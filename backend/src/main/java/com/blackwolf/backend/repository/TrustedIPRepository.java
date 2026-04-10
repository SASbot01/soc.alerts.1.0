package com.blackwolf.backend.repository;

import com.blackwolf.backend.model.TrustedIP;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface TrustedIPRepository extends JpaRepository<TrustedIP, String> {

    List<TrustedIP> findByCompanyIdOrderByCreatedAtDesc(String companyId);

    Optional<TrustedIP> findByIpAndCompanyId(String ip, String companyId);

    @Query("SELECT CASE WHEN COUNT(t) > 0 THEN true ELSE false END FROM TrustedIP t " +
           "WHERE t.companyId = :companyId AND t.ip = :ip")
    boolean existsByIpAndCompanyId(@Param("ip") String ip, @Param("companyId") String companyId);
}
