package com.blackwolf.backend.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "ml_models")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MlModel {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String companyId;
    private String modelType;
    private String name;
    private String version;

    @Column(columnDefinition = "json")
    private String config;

    @Column(columnDefinition = "json")
    private String metrics;

    private String status;
    private LocalDateTime trainedAt;
    private LocalDateTime createdAt;
}
