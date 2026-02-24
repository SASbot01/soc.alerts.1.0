package com.blackwolf.backend.model;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "outreach_log")
public class OutreachLog {

    @Id
    private String id;

    @Column(name = "prospect_id", nullable = false)
    private String prospectId;

    @Column(name = "email_type", nullable = false)
    private String emailType;

    private String subject;

    @Column(nullable = false)
    private String status = "sent";

    @Column(name = "sent_at")
    private LocalDateTime sentAt;

    @Column(name = "opened_at")
    private LocalDateTime openedAt;

    @Column(name = "clicked_at")
    private LocalDateTime clickedAt;

    @Column(name = "error_message", columnDefinition = "TEXT")
    private String errorMessage;

    @PrePersist
    protected void onCreate() {
        if (id == null) id = java.util.UUID.randomUUID().toString();
        if (sentAt == null) sentAt = LocalDateTime.now();
    }
}
