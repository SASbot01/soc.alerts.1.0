package com.blackwolf.backend.model;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "asset_sensor_assignments")
@IdClass(AssetSensorAssignmentId.class)
public class AssetSensorAssignment {
    @Id
    private String assetId;

    @Id
    private String sensorId;

    private LocalDateTime assignedAt;
    private String assignedBy;
    private Boolean isActive;

    @Column(columnDefinition = "TEXT")
    private String monitoringConfig;
}
