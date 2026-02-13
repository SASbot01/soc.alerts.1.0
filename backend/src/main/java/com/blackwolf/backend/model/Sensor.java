package com.blackwolf.backend.model;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "sensors")
public class Sensor {
    @Id
    private String id;

    private String name;
    private String companyId;
    private String status;
    private String sensorType;
    private String category;

    @Column(columnDefinition = "TEXT")
    private String description;

    private Boolean isTemplate;
    private String sourceTemplateId;
    private String detectedThreats;
    private String targetAssetTypes;
    private String icon;

    @Column(columnDefinition = "TEXT")
    private String configInstructions;

    @Column(columnDefinition = "TEXT")
    private String setupCommand;

    private LocalDateTime registeredAt;
    private LocalDateTime lastSeen;
    private Long packetsProcessed;
    private Long threatsDetected;
}
