package com.blackwolf.backend.model;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "cloud_log_sources")
public class CloudLogSource {

    @Id
    private String id;

    @Column(name = "company_id")
    private String companyId;

    private String provider; // aws, azure, gcp

    @Column(name = "source_type")
    private String sourceType;

    private String name;

    @Column(columnDefinition = "TEXT")
    private String config; // JSON

    @Column(name = "is_active")
    private boolean isActive;

    @Column(name = "last_poll_at")
    private LocalDateTime lastPollAt;

    @Column(name = "events_ingested")
    private Long eventsIngested;

    @Column(name = "last_error", columnDefinition = "TEXT")
    private String lastError;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        if (id == null) id = java.util.UUID.randomUUID().toString();
        if (eventsIngested == null) eventsIngested = 0L;
        isActive = true;
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
