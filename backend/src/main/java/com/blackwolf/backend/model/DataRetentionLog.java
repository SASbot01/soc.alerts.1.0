package com.blackwolf.backend.model;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "data_retention_logs")
public class DataRetentionLog {
    @Id
    private String id;

    private String companyId;
    private LocalDateTime runAt;
    private int retentionDays;
    private int threatsDeleted;
    private int alertsDeleted;
    private int activityLogsDeleted;
    private String status;
    private String errorMessage;
}
