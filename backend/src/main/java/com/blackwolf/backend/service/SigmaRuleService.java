package com.blackwolf.backend.service;

import com.blackwolf.backend.model.SigmaRule;
import com.blackwolf.backend.model.ThreatEvent;
import com.blackwolf.backend.repository.SigmaRuleRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.yaml.snakeyaml.Yaml;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;

@Service
public class SigmaRuleService {

    private static final Logger log = LoggerFactory.getLogger(SigmaRuleService.class);
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final Yaml yaml = new Yaml();

    @Autowired
    private SigmaRuleRepository ruleRepository;

    @Autowired
    private ActivityLogService activityLogService;

    public List<SigmaRule> listByCompany(String companyId) {
        return ruleRepository.findByCompanyIdOrderByUpdatedAtDesc(companyId);
    }

    public List<SigmaRule> listGlobal() {
        return ruleRepository.findByCompanyIdIsNullOrderByTitleAsc();
    }

    public SigmaRule getById(String ruleId) {
        return ruleRepository.findById(ruleId)
                .orElseThrow(() -> new RuntimeException("SIGMA rule not found"));
    }

    @Transactional
    public SigmaRule create(String companyId, Map<String, Object> request, String performedBy) {
        SigmaRule rule = new SigmaRule();
        rule.setCompanyId(companyId);
        rule.setTitle((String) request.get("title"));
        rule.setDescription((String) request.get("description"));
        rule.setRuleYaml((String) request.get("ruleYaml"));
        rule.setLevel((String) request.getOrDefault("level", "medium"));
        rule.setStatus((String) request.getOrDefault("status", "experimental"));
        rule.setTags((String) request.get("tags"));
        rule.setMitreTechniques((String) request.get("mitreTechniques"));
        rule.setAuthor((String) request.getOrDefault("author", performedBy));

        // Parse YAML to extract logsource
        parseAndSetLogsource(rule);

        rule = ruleRepository.save(rule);

        activityLogService.log(companyId, "SIGMA", rule.getId(), "CREATED", performedBy,
                "SIGMA rule created: " + rule.getTitle());

        return rule;
    }

    @Transactional
    public SigmaRule update(String ruleId, String companyId, Map<String, Object> request, String performedBy) {
        SigmaRule rule = getById(ruleId);
        if (rule.getCompanyId() != null && !rule.getCompanyId().equals(companyId)) {
            throw new RuntimeException("Access denied");
        }

        if (request.containsKey("title")) rule.setTitle((String) request.get("title"));
        if (request.containsKey("description")) rule.setDescription((String) request.get("description"));
        if (request.containsKey("ruleYaml")) {
            rule.setRuleYaml((String) request.get("ruleYaml"));
            parseAndSetLogsource(rule);
        }
        if (request.containsKey("level")) rule.setLevel((String) request.get("level"));
        if (request.containsKey("status")) rule.setStatus((String) request.get("status"));
        if (request.containsKey("isEnabled")) rule.setIsEnabled((Boolean) request.get("isEnabled"));
        if (request.containsKey("tags")) rule.setTags((String) request.get("tags"));
        if (request.containsKey("mitreTechniques")) rule.setMitreTechniques((String) request.get("mitreTechniques"));

        return ruleRepository.save(rule);
    }

    @Transactional
    public void delete(String ruleId, String companyId, String performedBy) {
        SigmaRule rule = getById(ruleId);
        if (rule.getCompanyId() != null && !rule.getCompanyId().equals(companyId)) {
            throw new RuntimeException("Access denied");
        }
        ruleRepository.delete(rule);
        activityLogService.log(companyId, "SIGMA", ruleId, "DELETED", performedBy,
                "SIGMA rule deleted: " + rule.getTitle());
    }

    @Transactional
    public SigmaRule toggleEnabled(String ruleId, String companyId) {
        SigmaRule rule = getById(ruleId);
        if (rule.getCompanyId() != null && !rule.getCompanyId().equals(companyId)) {
            throw new RuntimeException("Access denied");
        }
        rule.setIsEnabled(!rule.getIsEnabled());
        return ruleRepository.save(rule);
    }

    /**
     * Evaluate a threat event against all enabled SIGMA rules for the company.
     * Returns list of matched rule IDs.
     */
    @Transactional
    public List<String> evaluateEvent(ThreatEvent event) {
        List<SigmaRule> enabledRules = ruleRepository.findEnabledByCompanyId(event.getCompanyId());
        List<String> matchedRuleIds = new ArrayList<>();

        for (SigmaRule rule : enabledRules) {
            try {
                if (matchesSigmaRule(rule, event)) {
                    matchedRuleIds.add(rule.getId());
                    rule.setMatchCount(rule.getMatchCount() + 1);
                    rule.setLastMatchAt(LocalDateTime.now());
                    ruleRepository.save(rule);

                    log.debug("SIGMA: Rule '{}' matched event {} (severity: {})",
                            rule.getTitle(), event.getId(), event.getSeverity());
                }
            } catch (Exception e) {
                log.warn("SIGMA: Error evaluating rule '{}': {}", rule.getTitle(), e.getMessage());
            }
        }

        return matchedRuleIds;
    }

    @SuppressWarnings("unchecked")
    private boolean matchesSigmaRule(SigmaRule rule, ThreatEvent event) {
        try {
            Map<String, Object> parsed = yaml.load(rule.getRuleYaml());
            if (parsed == null) return false;

            // Extract detection block
            Map<String, Object> detection = (Map<String, Object>) parsed.get("detection");
            if (detection == null) return false;

            // Get the condition
            String condition = (String) detection.get("condition");
            if (condition == null) return false;

            // Get selection criteria
            Map<String, Object> selection = (Map<String, Object>) detection.get("selection");
            if (selection == null) return false;

            // Match against event fields
            boolean matches = true;
            for (Map.Entry<String, Object> entry : selection.entrySet()) {
                String field = entry.getKey();
                Object expectedValue = entry.getValue();

                String actualValue = getEventFieldValue(event, field);
                if (actualValue == null) {
                    matches = false;
                    break;
                }

                if (expectedValue instanceof List) {
                    List<String> values = (List<String>) expectedValue;
                    boolean anyMatch = values.stream().anyMatch(v ->
                            actualValue.toLowerCase().contains(v.toString().toLowerCase()));
                    if (!anyMatch) {
                        matches = false;
                        break;
                    }
                } else if (expectedValue instanceof String) {
                    String expected = (String) expectedValue;
                    // Support wildcards
                    if (expected.contains("*")) {
                        String regex = expected.replace("*", ".*");
                        if (!actualValue.toLowerCase().matches(regex.toLowerCase())) {
                            matches = false;
                            break;
                        }
                    } else if (!actualValue.toLowerCase().contains(expected.toLowerCase())) {
                        matches = false;
                        break;
                    }
                } else if (expectedValue instanceof Number) {
                    try {
                        int actual = Integer.parseInt(actualValue);
                        int expected = ((Number) expectedValue).intValue();
                        if (actual < expected) {
                            matches = false;
                            break;
                        }
                    } catch (NumberFormatException e) {
                        matches = false;
                        break;
                    }
                }
            }

            // Handle "not" condition
            if (condition.startsWith("selection and not")) {
                Map<String, Object> filter = (Map<String, Object>) detection.get("filter");
                if (filter != null && matches) {
                    for (Map.Entry<String, Object> entry : filter.entrySet()) {
                        String actualValue = getEventFieldValue(event, entry.getKey());
                        if (actualValue != null && actualValue.equalsIgnoreCase(entry.getValue().toString())) {
                            return false; // Filtered out
                        }
                    }
                }
            }

            return matches;
        } catch (Exception e) {
            return false;
        }
    }

    private String getEventFieldValue(ThreatEvent event, String field) {
        return switch (field.toLowerCase()) {
            case "src_ip", "sourceip", "srcip" -> event.getSrcIp();
            case "dst_ip", "destinationip", "dstip" -> event.getDstIp();
            case "dst_port", "destinationport", "dstport" ->
                    event.getDstPort() != null ? event.getDstPort().toString() : null;
            case "threat_type", "eventtype", "threattype" -> event.getThreatType();
            case "severity", "level" ->
                    event.getSeverity() != null ? event.getSeverity().toString() : null;
            case "description", "message" -> event.getDescription();
            case "status" -> event.getStatus();
            case "sensor_id", "sensorid" -> event.getSensorId();
            default -> null;
        };
    }

    private void parseAndSetLogsource(SigmaRule rule) {
        try {
            Map<String, Object> parsed = yaml.load(rule.getRuleYaml());
            if (parsed != null && parsed.containsKey("logsource")) {
                @SuppressWarnings("unchecked")
                Map<String, Object> logsource = (Map<String, Object>) parsed.get("logsource");
                rule.setLogsourceCategory((String) logsource.get("category"));
                rule.setLogsourceProduct((String) logsource.get("product"));
            }
        } catch (Exception e) {
            log.warn("SIGMA: Failed to parse YAML for logsource extraction: {}", e.getMessage());
        }
    }

    public Map<String, Object> getStats(String companyId) {
        List<SigmaRule> rules = ruleRepository.findByCompanyIdOrderByUpdatedAtDesc(companyId);
        List<SigmaRule> globalRules = ruleRepository.findByCompanyIdIsNullOrderByTitleAsc();

        long enabled = rules.stream().filter(r -> Boolean.TRUE.equals(r.getIsEnabled())).count();
        long totalMatches = rules.stream().mapToInt(r -> r.getMatchCount() != null ? r.getMatchCount() : 0).sum();

        Map<String, Object> stats = new LinkedHashMap<>();
        stats.put("customRules", rules.size());
        stats.put("globalRules", globalRules.size());
        stats.put("enabledRules", enabled);
        stats.put("totalMatches", totalMatches);
        return stats;
    }
}
