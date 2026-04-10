package com.blackwolf.backend.model;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "trusted_ips")
public class TrustedIP {
    @Id
    private String id;

    private String companyId;
    private String ip;
    private String cidr;
    private String label;
    private String reason;
    private String createdBy;
    private LocalDateTime createdAt;

    @PrePersist
    public void prePersist() {
        if (id == null) id = java.util.UUID.randomUUID().toString();
        if (createdAt == null) createdAt = LocalDateTime.now();
    }
}
