package com.blackwolf.backend.model;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "companies")
public class Company {
    @Id
    private String id;

    private String companyName;
    private String domain;
    private String contactEmail;
    private String contactPhone;
    private String plan;
    private String apiKey;
    private String status;
    private LocalDateTime registeredAt;
    private Long totalThreats;

    // Stripe billing fields
    private String stripeCustomerId;
    private String stripeSubscriptionId;
    private String subscriptionStatus;
    private LocalDateTime trialEndsAt;
    private LocalDateTime currentPeriodEnd;
    private Integer maxAssets;
    private Integer maxUsers;
    private Integer retentionDays;
}
