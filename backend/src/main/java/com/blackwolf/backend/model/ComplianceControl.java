package com.blackwolf.backend.model;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "compliance_controls")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ComplianceControl {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long frameworkId;
    private String controlId;
    private String title;

    @Column(columnDefinition = "text")
    private String description;

    private String category;
    private String severity;
}
