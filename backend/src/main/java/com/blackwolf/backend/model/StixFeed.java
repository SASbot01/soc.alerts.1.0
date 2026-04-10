package com.blackwolf.backend.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "stix_feeds")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class StixFeed {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String companyId;
    private String name;
    private String url;
    private String feedType;
    private Boolean enabled;
    private LocalDateTime lastPoll;
    private Integer pollIntervalMin;
    private Integer iocCount;
    private LocalDateTime createdAt;
}
