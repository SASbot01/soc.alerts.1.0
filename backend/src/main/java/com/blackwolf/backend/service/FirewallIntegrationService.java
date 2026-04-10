package com.blackwolf.backend.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

@Service
@Slf4j
public class FirewallIntegrationService {

    // In-memory store: companyId -> list of firewall rules
    private final Map<Long, List<Map<String, Object>>> companyRules = new ConcurrentHashMap<>();

    public List<Map<String, Object>> getRules(Long companyId) {
        log.debug("Fetching firewall rules for company {}", companyId);
        return Collections.unmodifiableList(
                companyRules.getOrDefault(companyId, Collections.emptyList())
        );
    }

    public Map<String, Object> addRule(Long companyId, Map<String, Object> rule) {
        log.info("Adding firewall rule for company {}: {}", companyId, rule);

        Map<String, Object> newRule = new LinkedHashMap<>(rule);
        newRule.put("id", UUID.randomUUID().toString());
        newRule.put("createdAt", LocalDateTime.now().toString());

        companyRules.computeIfAbsent(companyId, k -> new ArrayList<>()).add(newRule);
        return newRule;
    }

    public void deleteRule(Long companyId, String ruleId) {
        log.info("Deleting firewall rule {} for company {}", ruleId, companyId);

        List<Map<String, Object>> rules = companyRules.get(companyId);
        if (rules != null) {
            boolean removed = rules.removeIf(r -> ruleId.equals(r.get("id")));
            if (!removed) {
                log.warn("Rule {} not found for company {}", ruleId, companyId);
            }
        }
    }

    public Map<String, Object> blockIp(Long companyId, String ip, String reason) {
        log.info("Blocking IP {} for company {} - reason: {}", ip, companyId, reason);

        Map<String, Object> rule = new LinkedHashMap<>();
        rule.put("action", "DROP");
        rule.put("direction", "inbound");
        rule.put("srcIp", ip);
        rule.put("protocol", "any");
        rule.put("port", "any");
        rule.put("reason", reason);
        rule.put("enabled", true);

        return addRule(companyId, rule);
    }

    public Map<String, Object> getStats(Long companyId) {
        log.debug("Getting firewall stats for company {}", companyId);

        List<Map<String, Object>> rules = companyRules.getOrDefault(companyId, Collections.emptyList());
        long totalRules = rules.size();

        long blockRules = rules.stream()
                .filter(r -> "DROP".equalsIgnoreCase(String.valueOf(r.getOrDefault("action", "")))
                        || "DENY".equalsIgnoreCase(String.valueOf(r.getOrDefault("action", ""))))
                .count();

        long allowRules = rules.stream()
                .filter(r -> "ALLOW".equalsIgnoreCase(String.valueOf(r.getOrDefault("action", "")))
                        || "ACCEPT".equalsIgnoreCase(String.valueOf(r.getOrDefault("action", ""))))
                .count();

        Map<String, Object> stats = new LinkedHashMap<>();
        stats.put("totalRules", totalRules);
        stats.put("blockRules", blockRules);
        stats.put("allowRules", allowRules);
        return stats;
    }
}
