package com.blackwolf.backend.model;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "vuln_findings")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class VulnFinding {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long scanId;
    private String cveId;
    private String title;

    @Column(columnDefinition = "text")
    private String description;

    private String severity;
    private BigDecimal cvssScore;
    private String affectedComponent;

    @Column(columnDefinition = "text")
    private String remediation;

    private String status;
    private LocalDateTime foundAt;
}
