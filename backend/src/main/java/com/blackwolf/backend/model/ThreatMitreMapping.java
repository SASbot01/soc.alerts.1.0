package com.blackwolf.backend.model;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "threat_mitre_mappings")
@IdClass(ThreatMitreMappingId.class)
public class ThreatMitreMapping {
    @Id
    private String threatEventId;

    @Id
    private String techniqueId;

    private Integer confidence;
    private LocalDateTime mappedAt;
}
