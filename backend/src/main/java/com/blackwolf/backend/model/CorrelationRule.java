package com.blackwolf.backend.model;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "correlation_rules")
public class CorrelationRule {
    @Id
    private String id;
    private String name;

    @Column(columnDefinition = "TEXT")
    private String description;

    private String ruleType;
    private Integer thresholdCount;
    private Integer timeWindowMinutes;
    private String threatType;
    private Integer minSeverity;
    private boolean createsIncident;
    private String incidentSeverity;
    private boolean isActive;
    private LocalDateTime createdAt;

    @Column(columnDefinition = "TEXT")
    private String chainSequence;
}
