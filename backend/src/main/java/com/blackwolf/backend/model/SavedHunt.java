package com.blackwolf.backend.model;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "saved_hunts")
public class SavedHunt {
    @Id
    private String id;

    @Column(name = "company_id")
    private String companyId;

    private String name;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(name = "query_config", columnDefinition = "JSON")
    private String queryConfig;

    @Column(name = "hunt_type")
    private String huntType;

    @Column(name = "schedule_cron")
    private String scheduleCron;

    @Column(name = "is_active")
    private Boolean isActive;

    @Column(name = "last_run_at")
    private LocalDateTime lastRunAt;

    @Column(name = "last_result_count")
    private Integer lastResultCount;

    private String tags;

    @Column(name = "created_by")
    private String createdBy;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        if (id == null) id = java.util.UUID.randomUUID().toString();
        if (createdAt == null) createdAt = LocalDateTime.now();
        if (updatedAt == null) updatedAt = LocalDateTime.now();
        if (isActive == null) isActive = true;
        if (huntType == null) huntType = "manual";
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
