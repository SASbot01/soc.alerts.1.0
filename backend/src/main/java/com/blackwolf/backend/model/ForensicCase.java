package com.blackwolf.backend.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "forensic_cases")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ForensicCase {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String companyId;
    private String title;

    @Column(columnDefinition = "text")
    private String description;

    private String status;
    private String severity;
    private String leadAnalyst;
    private LocalDateTime createdAt;
    private LocalDateTime closedAt;
}
