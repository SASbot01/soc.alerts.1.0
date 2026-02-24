package com.blackwolf.backend.model;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "integration_tickets")
public class IntegrationTicket {

    @Id
    private String id;

    @Column(name = "integration_id")
    private String integrationId;

    @Column(name = "incident_id")
    private String incidentId;

    @Column(name = "external_ticket_id")
    private String externalTicketId;

    @Column(name = "external_ticket_url")
    private String externalTicketUrl;

    private String status;

    @Column(name = "synced_at")
    private LocalDateTime syncedAt;

    @PrePersist
    protected void onCreate() {
        if (id == null) id = java.util.UUID.randomUUID().toString();
        if (syncedAt == null) syncedAt = LocalDateTime.now();
    }
}
