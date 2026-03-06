package com.blackwolf.backend.model;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Entity
@Table(name = "ai_evolution_snapshots")
public class AiEvolutionSnapshot {
    @Id
    private String id;

    private String companyId;
    private LocalDate snapshotDate;

    @Enumerated(EnumType.STRING)
    private PeriodType periodType;

    private Integer totalIncidentsStudied;
    private Double accuracyScore;
    private Double falsePositiveReductionPct;
    private Integer newPatternsCount;
    private Integer defenseImprovementsCount;
    private Long meanResponseTimeMs;
    private Double meanConfidenceScore;

    @Column(columnDefinition = "JSON")
    private String topAttackTypes;

    @Column(columnDefinition = "JSON")
    private String topDefensesProposed;

    @Column(columnDefinition = "JSON")
    private String learningMilestones;

    @Column(columnDefinition = "LONGTEXT")
    private String evolutionSummary;

    @Column(columnDefinition = "TEXT")
    private String areasOfImprovement;

    @Column(columnDefinition = "TEXT")
    private String areasNeedingAttention;

    private String previousSnapshotId;
    private Integer tokensUsed;
    private LocalDateTime createdAt;

    @PrePersist
    public void prePersist() {
        if (id == null) id = UUID.randomUUID().toString();
        if (createdAt == null) createdAt = LocalDateTime.now();
        if (periodType == null) periodType = PeriodType.DAILY;
    }

    public enum PeriodType {
        DAILY, WEEKLY, MONTHLY
    }
}
