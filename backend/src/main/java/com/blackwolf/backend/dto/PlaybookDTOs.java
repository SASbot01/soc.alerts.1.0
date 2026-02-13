package com.blackwolf.backend.dto;

import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

public class PlaybookDTOs {

    @Data
    public static class CreatePlaybookRequest {
        private String name;
        private String description;
        private String triggerType;
        private String triggerCondition;
        private List<CreateStepRequest> steps;
    }

    @Data
    public static class CreateStepRequest {
        private Integer stepOrder;
        private String actionType;
        private String actionConfig;
        private String description;
    }

    @Data
    public static class PlaybookDetailResponse {
        private String id;
        private String companyId;
        private String name;
        private String description;
        private String triggerType;
        private String triggerCondition;
        private Boolean isActive;
        private Boolean isTemplate;
        private String category;
        private String mitreTechniques;
        private String targetAssetTypes;
        private LocalDateTime createdAt;
        private LocalDateTime updatedAt;
        private List<StepResponse> steps;
        private List<ExecutionSummary> recentExecutions;
        private List<AssetPlaybookAssignmentResponse> assignedAssets;
    }

    @Data
    public static class StepResponse {
        private String id;
        private Integer stepOrder;
        private String actionType;
        private String actionConfig;
        private String description;
    }

    @Data
    public static class ExecutionSummary {
        private String id;
        private String playbookId;
        private String playbookName;
        private String triggerEventId;
        private String status;
        private LocalDateTime startedAt;
        private LocalDateTime completedAt;
        private String errorMessage;
    }

    @Data
    public static class ExecutionDetailResponse {
        private String id;
        private String playbookId;
        private String playbookName;
        private String triggerEventId;
        private String status;
        private LocalDateTime startedAt;
        private LocalDateTime completedAt;
        private String errorMessage;
        private List<ExecutionLogEntry> logs;
    }

    @Data
    public static class ExecutionLogEntry {
        private String id;
        private String stepId;
        private String stepDescription;
        private String actionType;
        private String status;
        private String output;
        private LocalDateTime executedAt;
    }

    @Data
    public static class PlaybookTemplateResponse {
        private String id;
        private String name;
        private String description;
        private String category;
        private String triggerType;
        private String triggerCondition;
        private String mitreTechniques;
        private String targetAssetTypes;
        private Integer stepCount;
        private List<StepResponse> steps;
        private Boolean alreadyDeployed;
    }

    @Data
    public static class DeployTemplateRequest {
        private String templateId;
        private Boolean activateImmediately;
    }

    @Data
    public static class AssignPlaybookRequest {
        private String playbookId;
        private String assetId;
        private Integer priority;
    }

    @Data
    public static class BulkAssignRequest {
        private String playbookId;
        private List<String> assetIds;
    }

    @Data
    public static class AssetPlaybookAssignmentResponse {
        private String assetId;
        private String assetName;
        private String assetType;
        private String assetIp;
        private String playbookId;
        private String playbookName;
        private String category;
        private Boolean isActive;
        private Integer priority;
        private LocalDateTime assignedAt;
        private String assignedBy;
    }
}
