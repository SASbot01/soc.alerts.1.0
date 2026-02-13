package com.blackwolf.backend.model;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "playbook_executions")
public class PlaybookExecution {
    @Id
    private String id;

    private String playbookId;
    private String companyId;
    private String triggerEventId;

    @Enumerated(EnumType.STRING)
    private ExecutionStatus status;

    private LocalDateTime startedAt;
    private LocalDateTime completedAt;

    @Column(columnDefinition = "TEXT")
    private String errorMessage;

    public enum ExecutionStatus {
        RUNNING, COMPLETED, FAILED, CANCELLED
    }
}
