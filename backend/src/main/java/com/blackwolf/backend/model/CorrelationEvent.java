package com.blackwolf.backend.model;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Entity
@Table(name = "correlation_events")
public class CorrelationEvent {
    @Id
    private String id;

    private String companyId;
    private String ruleId;
    private String threatEventId;
    private String incidentId;
    private LocalDateTime matchedAt;

    @Column(columnDefinition = "TEXT")
    private String details;

    @PrePersist
    public void prePersist() {
        if (id == null) id = UUID.randomUUID().toString();
        if (matchedAt == null) matchedAt = LocalDateTime.now();
    }
}
