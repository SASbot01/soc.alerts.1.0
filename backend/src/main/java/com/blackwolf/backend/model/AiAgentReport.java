package com.blackwolf.backend.model;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "ai_agent_reports")
public class AiAgentReport {
    @Id
    private String id;

    private String companyId;
    private String reportType;
    private String title;

    @Column(columnDefinition = "LONGTEXT")
    private String content;

    @Column(columnDefinition = "TEXT")
    private String summary;

    private Integer threatsAnalyzed;
    private Integer incidentsAnalyzed;
    private LocalDateTime periodStart;
    private LocalDateTime periodEnd;
    private Integer tokensUsed;
    private Boolean slackSent;
    private String status;

    @Column(columnDefinition = "TEXT")
    private String errorMessage;

    private String previousReportId;
    private LocalDateTime createdAt;
}
