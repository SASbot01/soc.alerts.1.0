package com.blackwolf.backend.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "identity_events")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class IdentityEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String companyId;
    private String eventType;
    private String username;
    private String sourceIp;
    private String userAgent;
    private Boolean success;
    private Integer riskScore;

    @Column(columnDefinition = "json")
    private String details;

    private LocalDateTime timestamp;
}
