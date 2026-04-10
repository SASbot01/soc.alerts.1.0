package com.blackwolf.backend.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "asm_domains")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AsmDomain {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String companyId;
    private String domain;
    private LocalDateTime discoveredAt;
    private LocalDateTime lastScan;
    private Integer subdomainsCount;
    private Integer openPortsCount;
    private Integer riskScore;
    private String status;
}
