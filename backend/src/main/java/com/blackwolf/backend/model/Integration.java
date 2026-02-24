package com.blackwolf.backend.model;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "integrations")
public class Integration {

    @Id
    private String id;

    @Column(name = "company_id")
    private String companyId;

    private String provider;
    private String category;

    @Column(name = "display_name")
    private String displayName;

    @Column(columnDefinition = "JSON")
    private String config;

    @Column(name = "is_active")
    private boolean isActive;

    @Column(name = "auto_create_tickets")
    private boolean autoCreateTickets;

    @Column(name = "min_severity_ticket")
    private Integer minSeverityTicket;

    @Column(name = "auto_page")
    private boolean autoPage;

    @Column(name = "min_severity_page")
    private Integer minSeverityPage;

    @Column(name = "last_sync_at")
    private LocalDateTime lastSyncAt;

    @Column(name = "last_error")
    private String lastError;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        if (id == null) id = java.util.UUID.randomUUID().toString();
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
