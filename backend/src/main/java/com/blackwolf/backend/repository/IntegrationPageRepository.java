package com.blackwolf.backend.repository;

import com.blackwolf.backend.model.IntegrationPage;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface IntegrationPageRepository extends JpaRepository<IntegrationPage, String> {
    List<IntegrationPage> findByIncidentId(String incidentId);
}
