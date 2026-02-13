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

    public enum ActionType {
        BLOCK_IP, CREATE_INCIDENT, SEND_ALERT, ENRICH_IP, UPDATE_STATUS, NOTIFY_SLACK, WEBHOOK_CALL
    }
}
