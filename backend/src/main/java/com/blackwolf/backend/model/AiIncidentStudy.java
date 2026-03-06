package com.blackwolf.backend.model;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Entity
@Table(name = "ai_incident_studies")
public class AiIncidentStudy {
    @Id
    private String id;

    private String companyId;
    private String incidentId;
    private String threatEventId;

    @Enumerated(EnumType.STRING)
    private StudyType studyType;

    @Enumerated(EnumType.STRING)
    private StudyStatus status;

    @Column(columnDefinition = "TEXT")
    private String rootCause;

    @Column(columnDefinition = "TEXT")
    private String attackVectorAnalysis;

    @Column(columnDefinition = "TEXT")
    private String vulnerabilityExploited;

    private Integer attackSophistication;

    @Column(columnDefinition = "JSON")
    private String defenseRecommendations;

    @Column(columnDefinition = "JSON")
    private String similarPastIncidents;

    @Column(columnDefinition = "JSON")
    private String newPatternsDiscovered;

    @Column(columnDefinition = "JSON")
    private String mitreTechniquesIdentified;

    @Column(columnDefinition = "TEXT")
    private String improvementInsights;

    @Column(columnDefinition = "TEXT")
    private String lessonsLearned;

    private Integer tokensUsed;
    private Long studyDurationMs;

    @Column(columnDefinition = "TEXT")
    private String errorMessage;

    private LocalDateTime createdAt;
    private LocalDateTime completedAt;

    @PrePersist
    public void prePersist() {
        if (id == null) id = UUID.randomUUID().toString();
        if (createdAt == null) createdAt = LocalDateTime.now();
        if (status == null) status = StudyStatus.PENDING;
        if (studyType == null) studyType = StudyType.DEEP_ANALYSIS;
    }

    public enum StudyType {
        DEEP_ANALYSIS, ROOT_CAUSE, PATTERN_DISCOVERY, DEFENSE_PROPOSAL
    }

    public enum StudyStatus {
        PENDING, IN_PROGRESS, COMPLETED, FAILED
    }
}
