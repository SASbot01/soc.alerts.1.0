package com.blackwolf.backend.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "log_sources")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LogSource {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String companyId;
    private String name;
    private String sourceType;

    @Column(columnDefinition = "json")
    private String config;

    private Boolean enabled;
    private LocalDateTime lastEventAt;
    private Long eventsToday;
    private LocalDateTime createdAt;
}
