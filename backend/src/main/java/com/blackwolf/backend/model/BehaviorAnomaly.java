package com.blackwolf.backend.model;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "behavior_anomalies")
public class BehaviorAnomaly {
    @Id
    private String id;

    private String companyId;
    private String profileId;
    private String anomalyType;
    private Double anomalyScore;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(columnDefinition = "TEXT")
    private String eventData;

    private Boolean isReviewed;
    private String reviewedBy;
    private LocalDateTime detectedAt;

    @PrePersist
    protected void onCreate() {
        if (id == null) id = java.util.UUID.randomUUID().toString();
        if (detectedAt == null) detectedAt = LocalDateTime.now();
        if (isReviewed == null) isReviewed = false;
    }
}
