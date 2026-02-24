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
public class VirusTotalProvider implements ThreatIntelProvider {

    private static final Logger log = LoggerFactory.getLogger(VirusTotalProvider.class);
    private final RestTemplate restTemplate = new RestTemplate();

    @Value("${threatintel.virustotal.api-key:}")
    private String apiKey;

    @Value("${threatintel.virustotal.enabled:false}")
    private boolean enabled;

    @Override
    public String getName() { return "virustotal"; }

    @Override
    public boolean isEnabled() { return enabled && apiKey != null && !apiKey.isBlank(); }

    @Override
    @SuppressWarnings("unchecked")
    public void enrich(ThreatEnrichment enrichment) {
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.set("x-apikey", apiKey);

            String url = "https://www.virustotal.com/api/v3/ip_addresses/" + enrichment.getIp();
            HttpEntity<Void> entity = new HttpEntity<>(headers);

            ResponseEntity<Map> response = restTemplate.exchange(url, HttpMethod.GET, entity, Map.class);
            Map<String, Object> data = (Map<String, Object>) response.getBody().get("data");
            Map<String, Object> attributes = (Map<String, Object>) data.get("attributes");
            Map<String, Object> stats = (Map<String, Object>) attributes.get("last_analysis_stats");

            enrichment.setVirustotalMalicious(toInt(stats.get("malicious")));
            enrichment.setVirustotalSuspicious(toInt(stats.get("suspicious")));
            enrichment.setVirustotalHarmless(toInt(stats.get("harmless")));

            log.debug("VirusTotal enriched {}: {}/{} malicious/suspicious",
                    enrichment.getIp(), enrichment.getVirustotalMalicious(), enrichment.getVirustotalSuspicious());
        } catch (Exception e) {
            log.warn("VirusTotal enrichment failed for {}: {}", enrichment.getIp(), e.getMessage());
        }
    }

    private int toInt(Object val) {
        if (val instanceof Number) return ((Number) val).intValue();
        return 0;
    }
}
