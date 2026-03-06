package com.blackwolf.backend.model;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "backup_statuses")
public class BackupStatus {
    @Id
    private String id;

    private String companyId;
    private String clientHost;
    private String jobName;
    private String status;
    private String backupType;
    private String target;
    private Long sizeBytes;
    private Integer durationSeconds;

    @Column(columnDefinition = "TEXT")
    private String errorMessage;

    private LocalDateTime startedAt;
    private LocalDateTime finishedAt;
    private LocalDateTime reportedAt;
}
