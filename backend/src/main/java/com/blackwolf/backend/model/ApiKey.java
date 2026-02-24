package com.blackwolf.backend.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "api_keys")
public class ApiKey {
    @Id
    private String id;

    private String companyId;
    private String name;
    private String keyPrefix;

    @JsonIgnore
    private String keyHash;

    private String scopes;
    private boolean isActive;
    private LocalDateTime lastUsedAt;
    private LocalDateTime expiresAt;
    private String createdBy;
    private LocalDateTime createdAt;
}
