package com.blackwolf.backend.model;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "playbook_steps")
public class PlaybookStep {
    @Id
    private String id;

    private String playbookId;
    private Integer stepOrder;

    @Enumerated(EnumType.STRING)
    private ActionType actionType;

    @Column(columnDefinition = "TEXT")
    private String actionConfig;

    private String description;
    private LocalDateTime createdAt;

    @Column(name = "position_x")
    private Double positionX;

    @Column(name = "position_y")
    private Double positionY;

    @Column(name = "node_type")
    private String nodeType;

    @Column(name = "condition_expression", columnDefinition = "TEXT")
    private String conditionExpression;

    @Column(name = "on_success_step_id")
    private String onSuccessStepId;

    @Column(name = "on_failure_step_id")
    private String onFailureStepId;

    @Column(name = "is_parallel")
    private Boolean isParallel;

    public enum ActionType {
        BLOCK_IP, CREATE_INCIDENT, SEND_ALERT, ENRICH_IP, UPDATE_STATUS, NOTIFY_SLACK, WEBHOOK_CALL, CONDITION, DELAY
    }
}
