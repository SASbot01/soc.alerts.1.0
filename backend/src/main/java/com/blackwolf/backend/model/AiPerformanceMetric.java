package com.blackwolf.backend.model;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "ai_performance_metrics")
public class AiPerformanceMetric {
    @Id
    private String id;

    @Column(name = "company_id")
    private String companyId;

    @Column(name = "metric_date")
    private LocalDate metricDate;

    @Column(name = "total_decisions")
    private Integer totalDecisions;

    @Column(name = "correct_decisions")
    private Integer correctDecisions;

    @Column(name = "overridden_decisions")
    private Integer overriddenDecisions;

    @Column(name = "auto_blocked_ips")
    private Integer autoBlockedIps;

    @Column(name = "auto_created_incidents")
    private Integer autoCreatedIncidents;

    @Column(name = "false_positive_rate")
    private Double falsePositiveRate;

    @Column(name = "mean_response_time_ms")
    private Long meanResponseTimeMs;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        if (id == null) id = java.util.UUID.randomUUID().toString();
        if (createdAt == null) createdAt = LocalDateTime.now();
    }
}
