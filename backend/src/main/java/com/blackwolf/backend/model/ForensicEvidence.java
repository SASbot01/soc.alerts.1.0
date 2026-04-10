package com.blackwolf.backend.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "forensic_evidence")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ForensicEvidence {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long caseId;
    private String evidenceType;
    private String name;

    @Column(columnDefinition = "text")
    private String description;

    private String filePath;
    private String hashSha256;
    private LocalDateTime collectedAt;
    private String collectedBy;

    @Column(columnDefinition = "json")
    private String chainOfCustody;
}
