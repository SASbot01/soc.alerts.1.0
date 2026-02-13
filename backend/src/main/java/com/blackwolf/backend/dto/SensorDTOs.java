package com.blackwolf.backend.dto;

import lombok.Data;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

public class SensorDTOs {

    @Data
    public static class SensorDataUpload {
        private String company_id;
        private String sensor_id;
        private String api_key;
        private String timestamp;
        private List<Map<String, Object>> packets;
        private List<ThreatInfo> threats;
        private Map<String, Object> stats;
    }

    @Data
    public static class ThreatInfo {
        private String threat_type;
        private Integer severity;
        private String src_ip;
        private String dst_ip;
        private Integer dst_port;
        private String description;
    }

    @Data
    public static class SensorResponse {
        private String status;
        private int processed_packets;
        private int processed_threats;
        private List<Command> commands;
    }

    @Data
    public static class Command {
        private String type;
        private String ip;
        private String reason;

        public Command(String type, String ip, String reason) {
            this.type = type;
            this.ip = ip;
            this.reason = reason;
        }
    }

    // ===== Sensor Catalog DTOs =====

    @Data
    public static class SensorTemplateResponse {
        private String id;
        private String name;
        private String description;
        private String sensorType;
        private String category;
        private String detectedThreats;
        private String targetAssetTypes;
        private String icon;
        private String configInstructions;
        private String setupCommand;
        private Boolean alreadyDeployed;
        private String deployedSensorId;
    }

    @Data
    public static class DeploySensorRequest {
        private String templateId;
        private String customName;
    }

    @Data
    public static class SensorDetailResponse {
        private String id;
        private String name;
        private String companyId;
        private String status;
        private String sensorType;
        private String category;
        private String description;
        private String detectedThreats;
        private String targetAssetTypes;
        private String icon;
        private String configInstructions;
        private String setupCommand;
        private String sourceTemplateId;
        private LocalDateTime registeredAt;
        private LocalDateTime lastSeen;
        private Long packetsProcessed;
        private Long threatsDetected;
        private List<AssetSensorAssignmentResponse> assignedAssets;
    }

    @Data
    public static class AssignSensorRequest {
        private String sensorId;
        private String assetId;
    }

    @Data
    public static class BulkAssignSensorRequest {
        private String sensorId;
        private List<String> assetIds;
    }

    @Data
    public static class AssetSensorAssignmentResponse {
        private String assetId;
        private String assetName;
        private String assetType;
        private String assetIp;
        private String sensorId;
        private String sensorName;
        private String sensorType;
        private String category;
        private Boolean isActive;
        private LocalDateTime assignedAt;
        private String assignedBy;
    }
}
