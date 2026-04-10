package com.blackwolf.backend.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "honey_events")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class HoneyEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long tokenId;
    private String sourceIp;
    private String userAgent;

    @Column(columnDefinition = "json")
    private String details;

    private LocalDateTime timestamp;
}
