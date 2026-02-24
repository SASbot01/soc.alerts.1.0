package com.blackwolf.backend.model;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "onboarding_requests")
public class OnboardingRequest {
    @Id
    private String id;
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

    @Column(columnDefinition = "TEXT")
    private String currentSecurityTools;

    @Column(columnDefinition = "TEXT")
    private String additionalNotes;

    private String alertEmail;
    private String alertSlackWebhook;
    private String preferredSla;

    private String selectedPlan;

    private String status;
    private String reviewedBy;
    private LocalDateTime reviewedAt;
    private LocalDateTime createdAt;
}
