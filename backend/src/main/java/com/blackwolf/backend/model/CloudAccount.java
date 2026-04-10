package com.blackwolf.backend.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "cloud_accounts")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CloudAccount {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String companyId;
    private String provider;
    private String accountId;
    private String alias;

    @Column(columnDefinition = "json")
    private String config;

    private Boolean enabled;
    private LocalDateTime lastScan;
    private Integer findingsCount;
    private LocalDateTime createdAt;
}
