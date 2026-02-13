package com.blackwolf.backend.model;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "playbooks")
public class Playbook {
    @Id
    private String id;

    private String companyId;
    private String name;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Enumerated(EnumType.STRING)
    private TriggerType triggerType;

    private String triggerCondition;
    private Boolean isActive;
    private Boolean isTemplate;
    private String category;
    private String sourceTemplateId;
    private String mitreTechniques;
    private String targetAssetTypes;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public enum TriggerType {
        THREAT_SEVERITY, THREAT_TYPE, INCIDENT_CREATED, MANUAL
    }
}
