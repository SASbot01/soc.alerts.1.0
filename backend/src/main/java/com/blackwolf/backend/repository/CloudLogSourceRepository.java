package com.blackwolf.backend.repository;

import com.blackwolf.backend.model.CloudLogSource;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface CloudLogSourceRepository extends JpaRepository<CloudLogSource, String> {
    List<CloudLogSource> findByCompanyIdOrderByCreatedAtDesc(String companyId);
    List<CloudLogSource> findByIsActiveTrueAndProvider(String provider);
}
