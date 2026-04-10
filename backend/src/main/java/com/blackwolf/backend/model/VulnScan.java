package com.blackwolf.backend.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "vuln_scans")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class VulnScan {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String companyId;
    private String target;
    private String scanType;
    private String status;
    private LocalDateTime startedAt;
    private LocalDateTime completedAt;
    private Integer findingsCount;
    private Integer criticalCount;
    private Integer highCount;
}
