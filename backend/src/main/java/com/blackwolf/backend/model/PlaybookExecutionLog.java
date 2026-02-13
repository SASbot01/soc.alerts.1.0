package com.blackwolf.backend.model;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "playbook_execution_logs")
public class PlaybookExecutionLog {
    @Id
    private String id;

    private String executionId;
    private String stepId;

    @Enumerated(EnumType.STRING)
    private LogStatus status;

    @Column(columnDefinition = "TEXT")
    private String output;

    private LocalDateTime executedAt;

    public enum LogStatus {
        SUCCESS, FAILED, SKIPPED
    }
}
