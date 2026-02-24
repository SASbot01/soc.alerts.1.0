package com.blackwolf.backend.model;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "cross_tenant_patterns")
public class CrossTenantPattern {
    @Id
    private String id;

    @Column(name = "pattern_type")
    private String patternType;

    @Column(name = "pattern_data", columnDefinition = "JSON")
    private String patternData;

    private Double confidence;

    @Column(name = "source_count")
    private Integer sourceCount;

    @Column(name = "first_seen")
    private LocalDateTime firstSeen;

    @Column(name = "last_seen")
    private LocalDateTime lastSeen;

    @Column(name = "is_active")
    private Boolean isActive;

    @PrePersist
    protected void onCreate() {
        if (id == null) id = java.util.UUID.randomUUID().toString();
        if (firstSeen == null) firstSeen = LocalDateTime.now();
        if (lastSeen == null) lastSeen = LocalDateTime.now();
        if (isActive == null) isActive = true;
        if (confidence == null) confidence = 0.5;
        if (sourceCount == null) sourceCount = 1;
    }
}
