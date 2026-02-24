package com.blackwolf.backend.model;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "ai_learning_events")
public class AiLearningEvent {
    @Id
    private String id;

    @Column(name = "company_id")
    private String companyId;

    @Column(name = "event_type")
    private String eventType;

    @Column(name = "original_verdict")
    private String originalVerdict;

    @Column(name = "corrected_verdict")
    private String correctedVerdict;

    @Column(name = "threat_type")
    private String threatType;

    @Column(name = "threat_event_id")
    private String threatEventId;

    @Column(columnDefinition = "JSON")
    private String context;

    private Double confidence;

    @Column(name = "learned_at")
    private LocalDateTime learnedAt;

    @PrePersist
    protected void onCreate() {
        if (id == null) id = java.util.UUID.randomUUID().toString();
        if (learnedAt == null) learnedAt = LocalDateTime.now();
    }
}
