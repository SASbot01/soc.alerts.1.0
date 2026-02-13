package com.blackwolf.backend.model;

import lombok.Data;
import java.io.Serializable;

@Data
public class ThreatMitreMappingId implements Serializable {
    private String threatEventId;
    private String techniqueId;
}
