package com.blackwolf.backend.dto;

import lombok.Data;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

public class InfrastructureDTOs {

    // ===== Backup DTOs =====

    @Data
    public static class BackupReportRequest {
        private String company_id;
        private String api_key;
        private String client_host;
        private String job_name;
        private String status;
        private String backup_type;
        private String target;
        private Long size_bytes;
        private Integer duration_seconds;
        private String error_message;
        private String started_at;
        private String finished_at;
    }

    @Data
    public static class BackupDashboard {
        private long totalJobs;
        private long successCount;
        private long failedCount;
        private long staleCount;
        private long totalSizeBytes;
        private List<BackupJobSummary> jobs;
        private List<BackupHostSummary> hosts;
    }

    @Data
    public static class BackupJobSummary {
        private String id;
        private String clientHost;
        private String jobName;
        private String status;
        private String backupType;
        private String target;
        private Long sizeBytes;
        private Integer durationSeconds;
        private String errorMessage;
        private LocalDateTime startedAt;
        private LocalDateTime finishedAt;
        private LocalDateTime reportedAt;
    }

    @Data
    public static class BackupHostSummary {
        private String host;
        private long totalJobs;
        private long successJobs;
        private long failedJobs;
        private LocalDateTime lastBackup;
    }

    // ===== Health Check DTOs =====

    @Data
    public static class CreateHealthCheckRequest {
        private String name;
        private String checkType;
        private String target;
        private Integer port;
        private Integer expectedStatus;
        private Integer timeoutMs;
        private Integer intervalSeconds;
    }

    @Data
    public static class HealthCheckDashboard {
        private long totalTargets;
        private long healthyCount;
        private long failingCount;
        private long unknownCount;
        private List<HealthCheckTargetStatus> targets;
    }

    @Data
    public static class HealthCheckTargetStatus {
        private String id;
        private String name;
        private String checkType;
        private String target;
        private Integer port;
        private Boolean enabled;
        private String lastStatus;
        private Integer lastResponseTimeMs;
        private String lastError;
        private LocalDateTime lastCheckedAt;
        private double uptimePercent;
    }

    @Data
    public static class RunHealthCheckResponse {
        private String targetId;
        private String targetName;
        private String status;
        private Integer responseTimeMs;
        private Integer statusCode;
        private String errorMessage;
        private LocalDateTime checkedAt;
    }

    // ===== LDAP DTOs =====

    @Data
    public static class LdapUserCreateRequest {
        private String username;
        private String email;
        private String displayName;
        private String group;
        private String password;
    }

    @Data
    public static class LdapBulkCreateRequest {
        private List<LdapUserCreateRequest> users;
    }

    @Data
    public static class LdapSyncResponse {
        private int created;
        private int failed;
        private List<LdapSyncResult> results;
    }

    @Data
    public static class LdapSyncResult {
        private String username;
        private String status;
        private String error;
    }

    @Data
    public static class LdapConfig {
        private String ldapUrl;
        private String adminUser;
        private String baseDn;
        private boolean connected;
    }
}
