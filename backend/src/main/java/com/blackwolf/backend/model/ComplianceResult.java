package com.blackwolf.backend.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "compliance_results")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ComplianceResult {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long assessmentId;
    private Long controlId;
    private String status;

    @Column(columnDefinition = "text")
    private String evidence;

    @Column(columnDefinition = "text")
    private String notes;

    private LocalDateTime checkedAt;
}
