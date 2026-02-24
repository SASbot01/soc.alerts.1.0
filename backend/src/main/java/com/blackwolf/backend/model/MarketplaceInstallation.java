package com.blackwolf.backend.model;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "marketplace_installations")
public class MarketplaceInstallation {

    @Id
    private String id;

    @Column(name = "company_id")
    private String companyId;

    @Column(name = "item_id")
    private String itemId;

    @Column(name = "installed_version")
    private String installedVersion;

    @Column(name = "installed_at")
    private LocalDateTime installedAt;

    @Column(name = "installed_by")
    private String installedBy;

    @Column(name = "is_active")
    private boolean isActive;

    @PrePersist
    protected void onCreate() {
        if (id == null) id = java.util.UUID.randomUUID().toString();
        isActive = true;
        installedAt = LocalDateTime.now();
    }
}
