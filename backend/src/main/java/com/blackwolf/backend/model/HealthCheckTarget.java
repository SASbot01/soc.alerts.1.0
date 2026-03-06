package com.blackwolf.backend.model;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "health_check_targets")
public class HealthCheckTarget {
    @Id
    private String id;

    private String companyId;
    private String name;
    private String checkType;
    private String target;
    private Integer port;
    private Integer expectedStatus;
    private Integer timeoutMs;
    private Integer intervalSeconds;
    private Boolean enabled;
    private LocalDateTime createdAt;
}
