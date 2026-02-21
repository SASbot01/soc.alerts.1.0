package com.blackwolf.backend.service;

import com.blackwolf.backend.model.CorrelationEvent;
import com.blackwolf.backend.model.CorrelationRule;
import com.blackwolf.backend.model.ThreatEvent;
import com.blackwolf.backend.repository.CorrelationEventRepository;
import com.blackwolf.backend.repository.CorrelationRuleRepository;
import com.blackwolf.backend.repository.ThreatEventRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class CorrelationService {

    private static final Logger log = LoggerFactory.getLogger(CorrelationService.class);
    private static final ObjectMapper objectMapper = new ObjectMapper();

    @Autowired
    private CorrelationRuleRepository ruleRepository;

    @Autowired
    private ThreatEventRepository threatEventRepository;

    @Autowired
    private IncidentService incidentService;

    @Autowired
    private AlertService alertService;

    @Autowired
    private CorrelationEventRepository correlationEventRepository;

    @Autowired
    private SseService sseService;

    // Deduplication window: skip creating incidents if this rule already fired recently
    private static final int DEDUP_WINDOW_MINUTES = 15;

    public void evaluateThreat(ThreatEvent threat) {
        List<CorrelationRule> rules = ruleRepository.findByIsActiveTrue();

        for (CorrelationRule rule : rules) {
            if (matchesRule(threat, rule)) {
                log.info("Correlation rule '{}' triggered for threat {}", rule.getName(), threat.getId());

                // Deduplication: skip incident creation if this rule already fired recently
                LocalDateTime dedupSince = LocalDateTime.now().minusMinutes(DEDUP_WINDOW_MINUTES);
                long recentFires = correlationEventRepository.countRecentByRule(
                        threat.getCompanyId(), rule.getId(), dedupSince);

                String incidentId = null;
                if (rule.isCreatesIncident() && recentFires == 0) {
                    var incident = incidentService.createFromThreat(
                            threat.getCompanyId(),
                            threat.getId(),
                            threat.getThreatType(),
                            threat.getSeverity(),
                            "Auto-created by correlation rule: " + rule.getName() + "\n" + threat.getDescription()
                    );
                    incidentId = incident.getId();
                    alertService.fireAlertsForIncident(
                            threat.getCompanyId(), incident.getId(),
                            incident.getTitle(), incident.getSeverity());
                } else if (recentFires > 0) {
                    log.debug("Correlation rule '{}' skipped incident creation (dedup: {} recent fires in {}min)",
                            rule.getName(), recentFires, DEDUP_WINDOW_MINUTES);
                }

                // Record correlation event for every rule match
                CorrelationEvent event = new CorrelationEvent();
                event.setCompanyId(threat.getCompanyId());
                event.setRuleId(rule.getId());
                event.setThreatEventId(threat.getId());
                event.setIncidentId(incidentId);
                event.setDetails("Rule '" + rule.getName() + "' matched threat " + threat.getThreatType()
                        + " from " + threat.getSrcIp());
                correlationEventRepository.save(event);

                // Emit SSE alert for attack chains
                if ("attack_chain".equals(rule.getRuleType())) {
                    sseService.emitAlert(threat.getCompanyId(), "ATTACK_CHAIN",
                            "Attack chain detected: " + rule.getName() + " — source IP " + threat.getSrcIp());
                }
            }
        }
    }

    private boolean matchesRule(ThreatEvent threat, CorrelationRule rule) {
        LocalDateTime windowStart = LocalDateTime.now().minusMinutes(rule.getTimeWindowMinutes());
        List<ThreatEvent> recentThreats = threatEventRepository.findByCompanyId(threat.getCompanyId())
                .stream()
                .filter(t -> t.getTimestamp() != null && t.getTimestamp().isAfter(windowStart))
                .collect(Collectors.toList());

        return switch (rule.getRuleType()) {
            case "severity_threshold" ->
                    threat.getSeverity() != null && threat.getSeverity() >= rule.getMinSeverity();

            case "same_ip_same_type" -> {
                if (rule.getThreatType() != null && !rule.getThreatType().equals(threat.getThreatType())) {
                    yield false;
                }
                long count = recentThreats.stream()
                        .filter(t -> threat.getSrcIp().equals(t.getSrcIp())
                                && threat.getThreatType().equals(t.getThreatType()))
                        .count();
                yield count >= rule.getThresholdCount();
            }

            case "same_type_threshold" -> {
                if (rule.getThreatType() != null && !rule.getThreatType().equals(threat.getThreatType())) {
                    yield false;
                }
                long count = recentThreats.stream()
                        .filter(t -> threat.getThreatType().equals(t.getThreatType()))
                        .count();
                yield count >= rule.getThresholdCount();
            }

            case "same_ip_multi_type" -> {
                long distinctTypes = recentThreats.stream()
                        .filter(t -> threat.getSrcIp().equals(t.getSrcIp()))
                        .map(ThreatEvent::getThreatType)
                        .distinct()
                        .count();
                yield distinctTypes >= rule.getThresholdCount();
            }

            case "attack_chain" -> matchesAttackChain(threat, rule, recentThreats);

            default -> false;
        };
    }

    private boolean matchesAttackChain(ThreatEvent threat, CorrelationRule rule, List<ThreatEvent> recentThreats) {
        if (rule.getChainSequence() == null || rule.getChainSequence().isBlank()) {
            return false;
        }

        List<String> chain;
        try {
            chain = objectMapper.readValue(rule.getChainSequence(), new TypeReference<List<String>>() {});
        } catch (Exception e) {
            log.error("Failed to parse chain_sequence for rule {}: {}", rule.getId(), e.getMessage());
            return false;
        }

        if (chain.isEmpty()) return false;

        // The current threat must match the LAST type in the chain
        String lastType = chain.get(chain.size() - 1);
        String normalizedThreatType = threat.getThreatType() != null
                ? threat.getThreatType().toUpperCase().replaceAll("[\\s-]+", "_") : "";
        if (!lastType.equals(normalizedThreatType)) {
            return false;
        }

        // Filter threats from the same source IP, sorted chronologically
        List<ThreatEvent> sameIpThreats = recentThreats.stream()
                .filter(t -> threat.getSrcIp() != null && threat.getSrcIp().equals(t.getSrcIp()))
                .sorted((a, b) -> {
                    if (a.getTimestamp() == null || b.getTimestamp() == null) return 0;
                    return a.getTimestamp().compareTo(b.getTimestamp());
                })
                .collect(Collectors.toList());

        // Walk through the chain sequence — each type must appear in chronological order
        int chainIdx = 0;
        for (ThreatEvent t : sameIpThreats) {
            String type = t.getThreatType() != null
                    ? t.getThreatType().toUpperCase().replaceAll("[\\s-]+", "_") : "";
            if (type.equals(chain.get(chainIdx))) {
                chainIdx++;
                if (chainIdx >= chain.size()) {
                    return true; // Full chain matched
                }
            }
        }

        return false;
    }
}
