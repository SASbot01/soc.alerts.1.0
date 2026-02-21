package com.blackwolf.backend.model;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "ai_noise_patterns")
public class AiNoisePattern {
    @Id
    private String id;

    private String companyId;
    private String srcIp;
    private String threatType;
    private Integer dstPort;
    private String descriptionPattern;

    @Column(columnDefinition = "TEXT")
    private String reason;

    private Integer suppressedCount;
    private LocalDateTime lastSeen;
    private Boolean isActive;
    private LocalDateTime expiresAt;
    private LocalDateTime createdAt;
    private String createdBy;
}
