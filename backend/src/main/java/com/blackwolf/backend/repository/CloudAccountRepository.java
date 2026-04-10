package com.blackwolf.backend.repository;

import com.blackwolf.backend.model.CloudAccount;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface CloudAccountRepository extends JpaRepository<CloudAccount, Long> {

    List<CloudAccount> findByCompanyIdOrderByCreatedAtDesc(String companyId);

    List<CloudAccount> findByCompanyIdAndEnabled(String companyId, Boolean enabled);
}
