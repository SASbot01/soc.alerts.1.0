package com.blackwolf.backend.service.threatintel;

import com.blackwolf.backend.model.ThreatEnrichment;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.util.Map;

@Component
public class GreyNoiseProvider implements ThreatIntelProvider {

    private static final Logger log = LoggerFactory.getLogger(GreyNoiseProvider.class);
    private final RestTemplate restTemplate = new RestTemplate();

    @Value("${threatintel.greynoise.api-key:}")
    private String apiKey;

    @Value("${threatintel.greynoise.enabled:false}")
    private boolean enabled;

    @Override
    public String getName() { return "greynoise"; }

    @Override
    public boolean isEnabled() { return enabled && apiKey != null && !apiKey.isBlank(); }

    @Override
    @SuppressWarnings("unchecked")
    public void enrich(ThreatEnrichment enrichment) {
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.set("key", apiKey);
            headers.set("Accept", "application/json");

            String url = "https://api.greynoise.io/v3/community/" + enrichment.getIp();
            HttpEntity<Void> entity = new HttpEntity<>(headers);

            ResponseEntity<Map> response = restTemplate.exchange(url, HttpMethod.GET, entity, Map.class);
            Map<String, Object> data = response.getBody();

            enrichment.setGreynoiseClassification((String) data.getOrDefault("classification", "unknown"));
            enrichment.setGreynoiseName((String) data.getOrDefault("name", ""));
            enrichment.setGreynoiseNoise(Boolean.TRUE.equals(data.get("noise")));
            enrichment.setGreynoiseRiot(Boolean.TRUE.equals(data.get("riot")));

            log.debug("GreyNoise enriched {}: classification={}, noise={}, riot={}",
                    enrichment.getIp(), enrichment.getGreynoiseClassification(),
                    enrichment.isGreynoiseNoise(), enrichment.isGreynoiseRiot());
        } catch (Exception e) {
            log.warn("GreyNoise enrichment failed for {}: {}", enrichment.getIp(), e.getMessage());
        }
    }
}
