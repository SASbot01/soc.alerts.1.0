package com.blackwolf.backend.model;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "integration_pages")
public class IntegrationPage {

    @Id
    private String id;

    @Column(name = "integration_id")
    private String integrationId;

    @Column(name = "incident_id")
    private String incidentId;

    @Column(name = "external_alert_id")
    private String externalAlertId;

    private String status;

    @Column(name = "paged_at")
    private LocalDateTime pagedAt;

    @PrePersist
    protected void onCreate() {
        if (id == null) id = java.util.UUID.randomUUID().toString();
        if (pagedAt == null) pagedAt = LocalDateTime.now();
    }
}
