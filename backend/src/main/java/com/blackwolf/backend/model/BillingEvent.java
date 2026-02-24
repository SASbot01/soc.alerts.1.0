package com.blackwolf.backend.model;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "billing_events")
public class BillingEvent {
    @Id
    private String id;

    private String companyId;

    @Column(unique = true, nullable = false)
    private String stripeEventId;

    private String eventType;

    @Column(columnDefinition = "JSON")
    private String payload;

    private LocalDateTime processedAt;
}
