package com.blackwolf.backend.model;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "marketplace_items")
public class MarketplaceItem {

    @Id
    private String id;

    @Column(name = "item_type")
    private String itemType;

    private String title;

    @Column(columnDefinition = "TEXT")
    private String description;

    private String author;

    private String version;

    @Column(columnDefinition = "TEXT")
    private String content;

    private String tags;

    private String category;

    @Column(name = "downloads")
    private Integer downloads;

    private Double rating;

    @Column(name = "rating_count")
    private Integer ratingCount;

    @Column(name = "is_verified")
    private boolean isVerified;

    @Column(name = "is_active")
    private boolean isActive;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        if (id == null) id = java.util.UUID.randomUUID().toString();
        if (downloads == null) downloads = 0;
        if (rating == null) rating = 0.0;
        if (ratingCount == null) ratingCount = 0;
        isActive = true;
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
