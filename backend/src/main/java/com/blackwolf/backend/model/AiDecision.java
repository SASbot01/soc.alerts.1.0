package com.blackwolf.backend.model;

import jakarta.persistence.*;
import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "ai_decisions")
public class AiDecision {
    @Id
    private String id;

    private String companyId;
    private String threatEventId;

    @Enumerated(EnumType.STRING)
    private Verdict verdict;

    private BigDecimal confidence;

    @Column(columnDefinition = "TEXT")
    private String reasoning;

    @Column(columnDefinition = "TEXT")
    private String actionsTaken;

    private String incidentCreatedId;
    private Boolean ipBlocked;
    private String playbookExecutedId;
    private String threatStatusUpdated;

    private String batchId;
    private Integer tokensUsed;

    @Enumerated(EnumType.STRING)
    private AnalysisMode analysisMode;

    private LocalDateTime createdAt;

    public enum Verdict {
        NOISE, FALSE_POSITIVE, LEGITIMATE_SCAN, SUSPICIOUS, REAL_ATTACK, CRITICAL_ATTACK
    }

    public enum AnalysisMode {
        IMMEDIATE, BATCH, SUPPRESSED
    }
}
