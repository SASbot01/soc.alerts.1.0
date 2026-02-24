package com.blackwolf.backend.service;

import com.blackwolf.backend.model.ThreatEnrichment;
import com.blackwolf.backend.repository.ThreatEnrichmentRepository;
import com.blackwolf.backend.service.threatintel.ThreatIntelProvider;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
public class ThreatIntelService {

    private static final Logger log = LoggerFactory.getLogger(ThreatIntelService.class);

    @Autowired
    private ThreatEnrichmentRepository enrichmentRepository;

    @Autowired
    private List<ThreatIntelProvider> providers;

    @Value("${threatintel.abuseipdb.api-key:}")
    private String abuseIpDbApiKey;

    @Value("${threatintel.abuseipdb.enabled:false}")
    private boolean abuseIpDbEnabled;

    private final RestTemplate restTemplate = new RestTemplate();

    public Optional<ThreatEnrichment> getEnrichment(String ip) {
        return enrichmentRepository.findById(ip);
    }

    public ThreatEnrichment enrichIp(String ip) {
        // Check cache first (valid for 24h)
        Optional<ThreatEnrichment> cached = enrichmentRepository.findById(ip);
        if (cached.isPresent() && cached.get().getEnrichedAt().isAfter(LocalDateTime.now().minusHours(24))) {
            return cached.get();
        }

        // Skip private IPs
        if (isPrivateIp(ip)) {
            ThreatEnrichment local = new ThreatEnrichment();
            local.setIp(ip);
            local.setCountryCode("LOCAL");
            local.setIsp("Private Network");
            local.setAbuseConfidenceScore(0);
            local.setTotalReports(0);
            local.setEnrichedAt(LocalDateTime.now());
            local.setEnrichmentSources("local");
            return enrichmentRepository.save(local);
        }

        // Start with AbuseIPDB (primary source)
        ThreatEnrichment enrichment;
        List<String> sources = new java.util.ArrayList<>();

        if (abuseIpDbEnabled && abuseIpDbApiKey != null && !abuseIpDbApiKey.isBlank()) {
            enrichment = enrichFromAbuseIpDb(ip);
            sources.add("abuseipdb");
        } else {
            enrichment = cached.orElse(new ThreatEnrichment());
            enrichment.setIp(ip);
            if (enrichment.getCountryCode() == null) enrichment.setCountryCode("UNKNOWN");
            if (enrichment.getAbuseConfidenceScore() == null) enrichment.setAbuseConfidenceScore(0);
            if (enrichment.getTotalReports() == null) enrichment.setTotalReports(0);
        }

        // Run all enabled additional providers
        for (ThreatIntelProvider provider : providers) {
            if (provider.isEnabled()) {
                try {
                    provider.enrich(enrichment);
                    sources.add(provider.getName());
                } catch (Exception e) {
                    log.warn("Provider {} failed for {}: {}", provider.getName(), ip, e.getMessage());
                }
            }
        }

        enrichment.setEnrichedAt(LocalDateTime.now());
        enrichment.setEnrichmentSources(String.join(",", sources));
        return enrichmentRepository.save(enrichment);
    }

    @SuppressWarnings("unchecked")
    private ThreatEnrichment enrichFromAbuseIpDb(String ip) {
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.set("Key", abuseIpDbApiKey);
            headers.set("Accept", "application/json");

            String url = "https://api.abuseipdb.com/api/v2/check?ipAddress=" + ip + "&maxAgeInDays=90";
            HttpEntity<String> entity = new HttpEntity<>(headers);

            ResponseEntity<Map> response = restTemplate.exchange(url, HttpMethod.GET, entity, Map.class);
            Map<String, Object> data = (Map<String, Object>) response.getBody().get("data");

            ThreatEnrichment enrichment = new ThreatEnrichment();
            enrichment.setIp(ip);
            enrichment.setAbuseConfidenceScore((Integer) data.getOrDefault("abuseConfidenceScore", 0));
            enrichment.setCountryCode((String) data.getOrDefault("countryCode", "UNKNOWN"));
            enrichment.setIsp((String) data.getOrDefault("isp", ""));
            enrichment.setDomain((String) data.getOrDefault("domain", ""));
            enrichment.setTor(Boolean.TRUE.equals(data.get("isTor")));
            enrichment.setTotalReports((Integer) data.getOrDefault("totalReports", 0));
            enrichment.setEnrichedAt(LocalDateTime.now());

            return enrichmentRepository.save(enrichment);
        } catch (Exception e) {
            log.error("AbuseIPDB enrichment failed for {}: {}", ip, e.getMessage());
            ThreatEnrichment fallback = new ThreatEnrichment();
            fallback.setIp(ip);
            fallback.setAbuseConfidenceScore(0);
            fallback.setCountryCode("ERROR");
            fallback.setEnrichedAt(LocalDateTime.now());
            return enrichmentRepository.save(fallback);
        }
    }

    private boolean isPrivateIp(String ip) {
        return ip.startsWith("10.") || ip.startsWith("172.16.") || ip.startsWith("172.17.")
                || ip.startsWith("172.18.") || ip.startsWith("172.19.") || ip.startsWith("172.2")
                || ip.startsWith("172.3") || ip.startsWith("192.168.") || ip.startsWith("127.")
                || ip.equals("localhost");
    }
}
