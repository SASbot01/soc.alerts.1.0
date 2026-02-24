package com.blackwolf.backend.model;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "outreach_metrics")
public class OutreachMetric {

    @Id
    private String id;

    @Column(name = "metric_date", nullable = false, unique = true)
    private LocalDate metricDate;

    @Column(name = "emails_sent")
    private int emailsSent;

    @Column(name = "emails_opened")
    private int emailsOpened;

    @Column(name = "emails_clicked")
    private int emailsClicked;

    @Column(name = "emails_bounced")
    private int emailsBounced;

    @Column(name = "replies_received")
    private int repliesReceived;

    private int conversions;

    @Column(name = "open_rate")
    private Double openRate;

    @Column(name = "click_rate")
    private Double clickRate;

    @Column(name = "conversion_rate")
    private Double conversionRate;

    @Column(name = "best_performing_template")
    private String bestPerformingTemplate;

    @Column(name = "best_send_hour")
    private Integer bestSendHour;

    @Column(columnDefinition = "TEXT")
    private String notes;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        if (id == null) id = java.util.UUID.randomUUID().toString();
        createdAt = LocalDateTime.now();
    }
}
