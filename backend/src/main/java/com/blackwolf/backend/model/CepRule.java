package com.blackwolf.backend.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "cep_rules")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CepRule {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String companyId;
    private String name;

    @Column(columnDefinition = "text")
    private String description;

    private String ruleType;

    @Column(columnDefinition = "json")
    private String conditions;

    @Column(columnDefinition = "json")
    private String actions;

    private Integer windowSeconds;
    private Integer threshold;
    private Boolean enabled;
    private Long hits;
    private LocalDateTime lastHit;
    private LocalDateTime createdAt;
}
