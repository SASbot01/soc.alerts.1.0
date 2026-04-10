package com.blackwolf.backend.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "compliance_frameworks")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ComplianceFramework {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String companyId;
    private String name;
    private String version;

    @Column(columnDefinition = "text")
    private String description;

    private Integer totalControls;
    private Boolean enabled;
    private LocalDateTime createdAt;
}
