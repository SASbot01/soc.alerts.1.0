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
public class ShodanProvider implements ThreatIntelProvider {

    private static final Logger log = LoggerFactory.getLogger(ShodanProvider.class);
    private final RestTemplate restTemplate = new RestTemplate();

    @Value("${threatintel.shodan.api-key:}")
    private String apiKey;

    @Value("${threatintel.shodan.enabled:false}")
    private boolean enabled;

    @Override
    public String getName() { return "shodan"; }

    @Override
    public boolean isEnabled() { return enabled && apiKey != null && !apiKey.isBlank(); }

    @Override
    @SuppressWarnings("unchecked")
    public void enrich(ThreatEnrichment enrichment) {
        try {
            String url = "https://api.shodan.io/shodan/host/" + enrichment.getIp() + "?key=" + apiKey;
            ResponseEntity<Map> response = restTemplate.getForEntity(url, Map.class);
            Map<String, Object> data = response.getBody();

            // Ports
            List<Integer> ports = (List<Integer>) data.getOrDefault("ports", List.of());
            enrichment.setShodanPorts(ports.stream().map(String::valueOf).collect(Collectors.joining(",")));

            // OS
            enrichment.setShodanOs((String) data.getOrDefault("os", ""));

            // Organization
            enrichment.setShodanOrg((String) data.getOrDefault("org", ""));

            // Vulnerabilities
            List<String> vulns = (List<String>) data.getOrDefault("vulns", List.of());
            if (!vulns.isEmpty()) {
                enrichment.setShodanVulns(String.join(",", vulns.subList(0, Math.min(vulns.size(), 20))));
            }

            log.debug("Shodan enriched {}: {} ports, {} vulns, org={}",
                    enrichment.getIp(), ports.size(), vulns.size(), enrichment.getShodanOrg());
        } catch (Exception e) {
            log.warn("Shodan enrichment failed for {}: {}", enrichment.getIp(), e.getMessage());
        }
    }
}
