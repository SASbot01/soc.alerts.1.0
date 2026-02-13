package com.blackwolf.backend.dto;

import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

public class AssetDTOs {

    @Data
    public static class CreateAssetRequest {
        private String name;
        private String assetType;
        private String ipAddress;
        private String hostname;
        private String operatingSystem;
        private String criticality;
        private String owner;
        private String location;
        private String notes;
    }

    @Data
    public static class UpdateAssetRequest {
        private String name;
        private String assetType;
        private String ipAddress;
        private String hostname;
        private String operatingSystem;
        private String criticality;
        private String owner;
        private String location;
        private String status;
        private String notes;
    }

    @Data
    public static class AssetDetailResponse {
        private String id;
        private String companyId;
        private String name;
        private String assetType;
        private String ipAddress;
        private String hostname;
        private String operatingSystem;
        private String criticality;
        private String owner;
        private String location;
        private String status;
        private String notes;
        private LocalDateTime createdAt;
        private LocalDateTime updatedAt;
        private List<LinkedVulnerability> vulnerabilities;
        private List<LinkedThreat> threats;
        private List<LinkedPlaybook> playbooks;
        private List<LinkedSensor> sensors;
    }

    @Data
    public static class LinkedVulnerability {
        private String id;
        private String title;
        private String cveId;
        private String riskLevel;
        private String status;
        private LocalDateTime discoveredAt;
    }

    @Data
    public static class LinkedThreat {
        private String id;
        private String threatType;
        private Integer severity;
        private String srcIp;
        private String dstIp;
        private LocalDateTime timestamp;
        private String status;
    }

    @Data
    public static class LinkedPlaybook {
        private String playbookId;
        private String playbookName;
        private String category;
        private Boolean isActive;
        private Integer priority;
    }

    @Data
    public static class LinkedSensor {
        private String sensorId;
        private String sensorName;
        private String sensorType;
        private String category;
        private Boolean isActive;
    }

    @Data
    public static class AssetDashboard {
        private long totalAssets;
        private Map<String, Long> byType;
        private Map<String, Long> byCriticality;
        private Map<String, Long> byStatus;
    }
}
