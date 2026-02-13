package com.blackwolf.backend.model;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "refresh_tokens")
public class RefreshToken {
    @Id
    private String id;

    private String userId;
    private String token;
    private LocalDateTime expiresAt;
    private boolean revoked;
    private String replacedBy;
    private LocalDateTime createdAt;
    private String createdByIp;

    public boolean isExpired() {
        return LocalDateTime.now().isAfter(expiresAt);
    }

    public boolean isActive() {
        return !revoked && !isExpired();
    }
}
