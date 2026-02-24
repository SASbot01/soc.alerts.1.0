package com.blackwolf.backend.repository;

import com.blackwolf.backend.model.IntegrationTicket;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface IntegrationTicketRepository extends JpaRepository<IntegrationTicket, String> {
    List<IntegrationTicket> findByIncidentId(String incidentId);
    Optional<IntegrationTicket> findByIntegrationIdAndIncidentId(String integrationId, String incidentId);
}
