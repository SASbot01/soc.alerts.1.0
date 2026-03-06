package com.blackwolf.backend.model;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "ldap_sync_logs")
public class LdapSyncLog {
    @Id
    private String id;

    private String companyId;
    private String action;
    private String username;
    private String ldapGroup;
    private String status;

    @Column(columnDefinition = "TEXT")
    private String errorMessage;

    private String performedBy;
    private LocalDateTime performedAt;
}
