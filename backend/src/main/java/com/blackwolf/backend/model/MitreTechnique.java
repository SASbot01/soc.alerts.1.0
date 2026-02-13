package com.blackwolf.backend.model;

import jakarta.persistence.*;
import lombok.Data;

@Data
@Entity
@Table(name = "mitre_techniques")
public class MitreTechnique {
    @Id
    private String id;

    private String name;
    private String tactic;

    @Column(columnDefinition = "TEXT")
    private String description;

    private String url;
}
