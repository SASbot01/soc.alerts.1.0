package com.blackwolf.backend.repository;

import com.blackwolf.backend.model.StixFeed;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface StixFeedRepository extends JpaRepository<StixFeed, Long> {

    List<StixFeed> findByCompanyIdOrderByCreatedAtDesc(String companyId);

    List<StixFeed> findByEnabled(Boolean enabled);
}
