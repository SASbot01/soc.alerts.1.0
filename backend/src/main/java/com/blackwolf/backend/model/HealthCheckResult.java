package com.blackwolf.backend.model;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "health_check_results")
public class HealthCheckResult {
    @Id
    private String id;

    private String targetId;
    private String companyId;
    private String status;
    private Integer responseTimeMs;
    private Integer statusCode;

    @Column(columnDefinition = "TEXT")
    private String errorMessage;

    private LocalDateTime checkedAt;
}
