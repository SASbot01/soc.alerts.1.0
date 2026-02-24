package com.blackwolf.backend.model;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "sigma_rules")
public class SigmaRule {
    @Id
    private String id;

    @Column(name = "company_id")
    private String companyId;

    private String title;

    @Column(columnDefinition = "TEXT")
    private String description;

    private String status;

    private String level;

    @Column(name = "rule_yaml", columnDefinition = "TEXT")
    private String ruleYaml;

    @Column(name = "logsource_category")
    private String logsourceCategory;

    @Column(name = "logsource_product")
    private String logsourceProduct;

    private String tags;

    @Column(name = "mitre_techniques")
    private String mitreTechniques;

    private String author;

    @Column(name = "rule_date")
    private LocalDate ruleDate;

    @Column(name = "is_enabled")
    private Boolean isEnabled;

    @Column(name = "match_count")
    private Integer matchCount;

    @Column(name = "last_match_at")
    private LocalDateTime lastMatchAt;

    private String source;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        if (id == null) id = java.util.UUID.randomUUID().toString();
        if (createdAt == null) createdAt = LocalDateTime.now();
        if (updatedAt == null) updatedAt = LocalDateTime.now();
        if (isEnabled == null) isEnabled = true;
        if (matchCount == null) matchCount = 0;
        if (status == null) status = "experimental";
        if (level == null) level = "medium";
        if (source == null) source = "custom";
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
