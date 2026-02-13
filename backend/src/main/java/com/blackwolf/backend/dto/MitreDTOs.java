package com.blackwolf.backend.dto;

import lombok.Data;

import java.time.LocalDateTime;

public class MitreDTOs {

    @Data
    public static class MapThreatRequest {
        private String techniqueId;
        private Integer confidence;
    }

    @Data
    public static class MitreMappingResponse {
        private String threatEventId;
        private String techniqueId;
        private String techniqueName;
        private String tactic;
        private Integer confidence;
        private LocalDateTime mappedAt;
    }
}
