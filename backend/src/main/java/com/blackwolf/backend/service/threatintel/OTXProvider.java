package com.blackwolf.backend.service.threatintel;

import com.blackwolf.backend.model.ThreatEnrichment;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Component
public class OTXProvider implements ThreatIntelProvider {

    private static final Logger log = LoggerFactory.getLogger(OTXProvider.class);
    private final RestTemplate restTemplate = new RestTemplate();

    @Value("${threatintel.otx.api-key:}")
    private String apiKey;

    @Value("${threatintel.otx.enabled:false}")
    private boolean enabled;

    @Override
    public String getName() { return "otx"; }

    @Override
    public boolean isEnabled() { return enabled && apiKey != null && !apiKey.isBlank(); }

    @Override
    @SuppressWarnings("unchecked")
    public void enrich(ThreatEnrichment enrichment) {
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.set("X-OTX-API-KEY", apiKey);

            String url = "https://otx.alienvault.com/api/v1/indicators/IPv4/" + enrichment.getIp() + "/general";
            HttpEntity<Void> entity = new HttpEntity<>(headers);

            ResponseEntity<Map> response = restTemplate.exchange(url, HttpMethod.GET, entity, Map.class);
            Map<String, Object> data = response.getBody();

            enrichment.setOtxPulseCount(toInt(data.getOrDefault("pulse_info", Map.of())));

            List<Map<String, Object>> pulses = (List<Map<String, Object>>) ((Map<String, Object>) data.getOrDefault("pulse_info", Map.of())).getOrDefault("pulses", List.of());
            if (!pulses.isEmpty()) {
                enrichment.setOtxPulseCount(pulses.size());
                // Collect unique tags from all pulses
                List<String> allTags = pulses.stream()
                        .flatMap(p -> ((List<String>) p.getOrDefault("tags", List.of())).stream())
                        .distinct()
                        .limit(20)
                        .collect(Collectors.toList());
                enrichment.setOtxTags(String.join(",", allTags));
            }

            log.debug("OTX enriched {}: {} pulses, tags={}",
                    enrichment.getIp(), enrichment.getOtxPulseCount(), enrichment.getOtxTags());
        } catch (Exception e) {
            log.warn("OTX enrichment failed for {}: {}", enrichment.getIp(), e.getMessage());
        }
    }

    private int toInt(Object val) {
        if (val instanceof Map) {
            Object count = ((Map<?, ?>) val).get("count");
            if (count instanceof Number) return ((Number) count).intValue();
        }
        if (val instanceof Number) return ((Number) val).intValue();
        return 0;
    }
}
