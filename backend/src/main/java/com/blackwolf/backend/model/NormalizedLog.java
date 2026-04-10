package com.blackwolf.backend.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "normalized_logs")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class NormalizedLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String companyId;
    private String sourceType;
    private String sourceName;
    private LocalDateTime timestamp;

    @Column(columnDefinition = "longtext")
    private String rawData;

    @Column(columnDefinition = "json")
    private String parsedData;

    private String severity;
    private String category;
    private String srcIp;
    private String dstIp;
    private Integer srcPort;
    private Integer dstPort;
    private String username;
    private String hostname;
    private String action;
    private String outcome;
    private LocalDateTime indexedAt;
}
