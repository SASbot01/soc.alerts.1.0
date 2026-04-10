package com.blackwolf.backend.model;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "compliance_assessments")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ComplianceAssessment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String companyId;
    private Long frameworkId;
    private LocalDateTime startedAt;
    private LocalDateTime completedAt;
    private String status;
    private BigDecimal overallScore;
    private Integer passed;
    private Integer failed;
    private Integer naCount;
}
