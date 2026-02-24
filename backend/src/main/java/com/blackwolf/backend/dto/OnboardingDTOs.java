package com.blackwolf.backend.dto;

import lombok.Data;

public class OnboardingDTOs {

    @Data
    public static class OnboardingFormRequest {
        private String companyName;
        private String domain;
        private String contactName;
        private String contactEmail;
        private String contactPhone;

        private boolean acceptsTerms;
        private boolean acceptsDpa;
        private boolean acceptsNda;

        private boolean monitorNetwork;
        private boolean monitorEndpoints;
        private boolean monitorCloud;
        private boolean monitorEmail;

        private Integer numServers;
        private Integer numEndpoints;
        private Integer numLocations;
        private String currentSecurityTools;
        private String additionalNotes;

        private String alertEmail;
        private String alertSlackWebhook;
        private String preferredSla;
        private String selectedPlan;
    }

    @Data
    public static class ReviewRequest {
        private String status;
    }

    @Data
    public static class ReviewResponse {
        private String id;
        private String status;
        // Only populated on approval
        private String companyId;
        private String apiKey;
        private String adminEmail;
        private String tempPassword;
        private String domain;
        private String companyName;
    }

    @Data
    public static class OnboardingCheckoutResponse {
        private String onboardingRequestId;
        private String checkoutUrl;
        private String checkoutSessionId;
    }
}
