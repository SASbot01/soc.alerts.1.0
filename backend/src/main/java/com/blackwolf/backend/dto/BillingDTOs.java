package com.blackwolf.backend.dto;

import lombok.Data;
import java.time.LocalDateTime;
import java.util.List;

public class BillingDTOs {

    @Data
    public static class BillingOverview {
        private String plan;
        private String subscriptionStatus;
        private LocalDateTime trialEndsAt;
        private LocalDateTime currentPeriodEnd;
        private PlanLimits limits;
        private UsageInfo usage;
        private List<InvoiceSummary> recentInvoices;
    }

    @Data
    public static class PlanLimits {
        private int maxAssets;
        private int maxUsers;
        private int retentionDays;
        private int priceMonthly; // in cents
    }

    @Data
    public static class UsageInfo {
        private long currentAssets;
        private long currentUsers;
    }

    @Data
    public static class InvoiceSummary {
        private String id;
        private Long amountDue;
        private Long amountPaid;
        private String currency;
        private String status;
        private String invoiceUrl;
        private String invoicePdf;
        private LocalDateTime periodStart;
        private LocalDateTime periodEnd;
        private LocalDateTime createdAt;
    }

    @Data
    public static class PlanInfo {
        private String planId;
        private String name;
        private int priceMonthly; // in cents
        private int maxAssets;
        private int maxUsers;
        private int retentionDays;
        private List<String> features;
    }

    @Data
    public static class CheckoutRequest {
        private String plan;
    }

    @Data
    public static class CheckoutResponse {
        private String sessionId;
        private String url;
    }

    @Data
    public static class ChangePlanRequest {
        private String newPlan;
    }

    @Data
    public static class PortalResponse {
        private String url;
    }

    @Data
    public static class PlanEnforcementResult {
        private boolean allowed;
        private String reason;
        private int current;
        private int max;
    }
}
