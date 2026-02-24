package com.blackwolf.backend.model;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "prospects")
public class Prospect {

    @Id
    private String id;

    @Column(nullable = false, unique = true)
    private String email;

    @Column(name = "company_name")
    private String companyName;

    private String domain;

    @Column(name = "contact_name")
    private String contactName;

    @Column(nullable = false)
    private String source = "manual";

    @Column(nullable = false)
    private String status = "new";

    @Column(name = "sequence_step", nullable = false)
    private int sequenceStep = 0;

    @Column(name = "last_email_at")
    private LocalDateTime lastEmailAt;

    @Column(name = "next_email_at")
    private LocalDateTime nextEmailAt;

    @Column(nullable = false)
    private int opens = 0;

    @Column(nullable = false)
    private int clicks = 0;

    @Column(nullable = false)
    private int replies = 0;

    @Column(nullable = false)
    private double score = 0;

    private String tags;

    @Column(columnDefinition = "TEXT")
    private String notes;

    @Column(name = "converted_company_id")
    private String convertedCompanyId;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        if (id == null) id = java.util.UUID.randomUUID().toString();
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
