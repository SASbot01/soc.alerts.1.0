package com.blackwolf.backend.model;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "hunt_results")
public class HuntResult {
    @Id
    private String id;

    @Column(name = "hunt_id")
    private String huntId;

    @Column(name = "company_id")
    private String companyId;

    @Column(name = "result_count")
    private Integer resultCount;

    @Column(name = "execution_time_ms")
    private Long executionTimeMs;

    @Column(columnDefinition = "JSON")
    private String findings;

    @Column(name = "executed_at")
    private LocalDateTime executedAt;

    @Column(name = "executed_by")
    private String executedBy;

    @PrePersist
    protected void onCreate() {
        if (id == null) id = java.util.UUID.randomUUID().toString();
        if (executedAt == null) executedAt = LocalDateTime.now();
    }
}
