package com.blackwolf.backend.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "forensic_timeline")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ForensicTimeline {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long caseId;
    private LocalDateTime timestamp;
    private String eventType;

    @Column(columnDefinition = "text")
    private String description;

    private String source;
    private String artifact;
}
