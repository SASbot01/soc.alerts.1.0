package com.blackwolf.backend.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "asm_discoveries")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AsmDiscovery {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long domainId;
    private String discoveryType;
    private String value;

    @Column(columnDefinition = "json")
    private String details;

    private String riskLevel;
    private LocalDateTime firstSeen;
    private LocalDateTime lastSeen;
}
