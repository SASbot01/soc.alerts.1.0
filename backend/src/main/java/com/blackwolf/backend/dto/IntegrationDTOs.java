package com.blackwolf.backend.dto;

import lombok.Data;
import java.time.LocalDateTime;
import java.util.List;

public class IntegrationDTOs {

    @Data
    public static class IntegrationResponse {
        private String id;
        private String provider;
        private String category;
        private String displayName;
        private boolean active;
        private boolean autoCreateTickets;
        private Integer minSeverityTicket;
        private boolean autoPage;
        private Integer minSeverityPage;
        private LocalDateTime lastSyncAt;
        private String lastError;
        private LocalDateTime createdAt;
        // config is NOT returned for security (contains api keys)
        private boolean configured;
    }

    @Data
    public static class SaveIntegrationRequest {
        private String provider;
        private String displayName;
        // Jira
        private String baseUrl;
        private String email;
        private String apiToken;
        private String projectKey;
        private String issueType;
        // ServiceNow
        private String instanceUrl;
        private String username;
        private String password;
        private String tableName;
        // PagerDuty
        private String routingKey;
        // OpsGenie
        private String apiKey;
        private String teamId;
        // Automation
        private boolean autoCreateTickets;
        private Integer minSeverityTicket;
        private boolean autoPage;
        private Integer minSeverityPage;
    }

    @Data
    public static class TestConnectionResponse {
        private boolean success;
        private String message;
    }

    @Data
    public static class TicketResponse {
        private String id;
        private String incidentId;
        private String externalTicketId;
        private String externalTicketUrl;
        private String status;
        private String provider;
        private LocalDateTime syncedAt;
    }

    @Data
    public static class PageResponse {
        private String id;
        private String incidentId;
        private String externalAlertId;
        private String status;
        private String provider;
        private LocalDateTime pagedAt;
    }

    @Data
    public static class IntegrationOverview {
        private List<IntegrationResponse> integrations;
        private int ticketingCount;
        private int alertingCount;
        private int activeCount;
    }

    @Data
    public static class AvailableProvider {
        private String provider;
        private String category;
        private String displayName;
        private String description;
        private String logoUrl;
        private boolean configured;
        private boolean active;
    }
}
