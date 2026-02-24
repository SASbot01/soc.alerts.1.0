package com.blackwolf.backend.model;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "entity_behavior_profiles")
public class EntityBehaviorProfile {
    @Id
    private String id;

    private String companyId;
    private String entityType;
    private String entityId;

    @Column(columnDefinition = "TEXT")
    private String baselineData;

    private Double riskScore;
    private Long totalEvents;
    private Integer anomalyCount;
    private LocalDateTime lastActivityAt;
    private LocalDateTime profileUpdatedAt;
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        if (id == null) id = java.util.UUID.randomUUID().toString();
        if (createdAt == null) createdAt = LocalDateTime.now();
        if (profileUpdatedAt == null) profileUpdatedAt = LocalDateTime.now();
    }
}
