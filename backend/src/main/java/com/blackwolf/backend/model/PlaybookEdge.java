package com.blackwolf.backend.model;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "playbook_edges")
public class PlaybookEdge {

    @Id
    private String id;

    @Column(name = "playbook_id")
    private String playbookId;

    @Column(name = "source_step_id")
    private String sourceStepId;

    @Column(name = "target_step_id")
    private String targetStepId;

    @Column(name = "edge_label")
    private String edgeLabel;

    @Column(name = "edge_type")
    private String edgeType;

    @Column(name = "condition_expression", columnDefinition = "TEXT")
    private String conditionExpression;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        if (id == null) id = java.util.UUID.randomUUID().toString();
        if (createdAt == null) createdAt = LocalDateTime.now();
    }
}
