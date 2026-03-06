package com.blackwolf.backend.repository;

import com.blackwolf.backend.model.LdapSyncLog;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface LdapSyncLogRepository extends JpaRepository<LdapSyncLog, String> {

    List<LdapSyncLog> findByCompanyIdOrderByPerformedAtDesc(String companyId);
}
