package com.blackwolf.backend.service.threatintel;

import com.blackwolf.backend.model.ThreatEnrichment;

public interface ThreatIntelProvider {

    String getName();

    boolean isEnabled();

    void enrich(ThreatEnrichment enrichment);
}
