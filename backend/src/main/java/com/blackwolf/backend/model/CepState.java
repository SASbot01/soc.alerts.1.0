package com.blackwolf.backend.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "cep_states")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CepState {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long ruleId;
    private String stateKey;

    @Column(columnDefinition = "json")
    private String stateData;

    private Integer eventCount;
    private LocalDateTime firstEvent;
    private LocalDateTime lastEvent;
    private LocalDateTime expiresAt;
}
