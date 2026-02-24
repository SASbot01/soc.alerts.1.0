package com.blackwolf.backend.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "sso_configurations")
public class SsoConfiguration {

    @Id
    private String id;

    @Column(name = "company_id", nullable = false, unique = true)
    private String companyId;

    @Column(nullable = false, length = 50)
    private String provider; // okta, azure_ad, google, custom_oidc

    @Column(name = "client_id", nullable = false, length = 500)
    private String clientId;

    @JsonIgnore
    @Column(name = "client_secret", nullable = false, length = 500)
    private String clientSecret;

    @Column(name = "issuer_url", nullable = false, length = 500)
    private String issuerUrl;

    @Column(name = "auto_provision_users")
    private boolean autoProvisionUsers = true;

    @Column(name = "default_role", length = 50)
    private String defaultRole = "analyst";

    @Column(name = "allowed_domains", length = 1000)
    private String allowedDomains;

    @Column(name = "is_active")
    private boolean isActive = false;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
