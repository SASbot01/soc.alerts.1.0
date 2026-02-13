package com.blackwolf.backend.model;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "assets")
public class Asset {
    @Id
    private String id;

    private String companyId;
    private String name;

    @Enumerated(EnumType.STRING)
    private AssetType assetType;

    @Column(length = 45)
    private String ipAddress;

    private String hostname;
    private String operatingSystem;

    @Enumerated(EnumType.STRING)
    private Criticality criticality;

    private String owner;
    private String location;

    @Enumerated(EnumType.STRING)
    private AssetStatus status;

    @Column(columnDefinition = "TEXT")
    private String notes;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public enum AssetType {
        SERVER, ENDPOINT, NETWORK_DEVICE, APPLICATION, DATABASE, CLOUD_RESOURCE, IOT_DEVICE
    }

    public enum Criticality {
        CRITICAL, HIGH, MEDIUM, LOW
    }

    public enum AssetStatus {
        ACTIVE, INACTIVE, DECOMMISSIONED
    }
}
