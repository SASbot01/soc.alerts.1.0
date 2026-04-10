package com.blackwolf.backend.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "cloud_findings")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CloudFinding {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long accountId;
    private String ruleId;
    private String resourceType;
    private String resourceId;
    private String region;
    private String severity;
    private String title;

    @Column(columnDefinition = "text")
    private String description;

    @Column(columnDefinition = "text")
    private String remediation;

    private String status;
    private LocalDateTime foundAt;
    private LocalDateTime resolvedAt;
}
