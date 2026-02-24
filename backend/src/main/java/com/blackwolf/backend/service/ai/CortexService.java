package com.blackwolf.backend.service.ai;

import com.blackwolf.backend.model.AiLearningEvent;
import com.blackwolf.backend.model.CrossTenantPattern;
import com.blackwolf.backend.model.AiPerformanceMetric;
import com.blackwolf.backend.repository.AiLearningEventRepository;
import com.blackwolf.backend.repository.CrossTenantPatternRepository;
import com.blackwolf.backend.repository.AiPerformanceMetricRepository;
import com.blackwolf.backend.repository.ThreatEventRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class CortexService {

    private static final Logger log = LoggerFactory.getLogger(CortexService.class);
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Autowired
    private AiLearningEventRepository learningEventRepository;

    @Autowired
    private CrossTenantPatternRepository patternRepository;

    @Autowired
    private AiPerformanceMetricRepository performanceRepository;

    @Autowired
    private ThreatEventRepository threatEventRepository;

    // Record every AI decision for learning
    @Transactional
    public void recordDecision(String companyId, String verdict, String threatType,
                                String threatEventId, Double confidence, Map<String, Object> context) {
        AiLearningEvent event = new AiLearningEvent();
        event.setCompanyId(companyId);
        event.setEventType("decision");
        event.setOriginalVerdict(verdict);
        event.setThreatType(threatType);
        event.setThreatEventId(threatEventId);
        event.setConfidence(confidence);
        try {
            event.setContext(objectMapper.writeValueAsString(context));
        } catch (Exception e) {
            event.setContext("{}");
        }
        learningEventRepository.save(event);
    }

    // Record when analyst overrides AI decision
    @Transactional
    public void recordAnalystOverride(String companyId, String originalVerdict, String correctedVerdict,
                                       String threatType, String threatEventId) {
        AiLearningEvent event = new AiLearningEvent();
        event.setCompanyId(companyId);
        event.setEventType("override");
        event.setOriginalVerdict(originalVerdict);
        event.setCorrectedVerdict(correctedVerdict);
        event.setThreatType(threatType);
        event.setThreatEventId(threatEventId);
        learningEventRepository.save(event);

        log.info("CORTEX: Analyst override recorded — {} -> {} for threat type '{}'",
                originalVerdict, correctedVerdict, threatType);
    }

    // Daily self-evaluation: compare AI verdicts vs analyst corrections
    @Scheduled(cron = "0 0 2 * * *") // 2 AM daily
    @Transactional
    public void selfEvaluate() {
        log.info("CORTEX: Starting daily self-evaluation...");

        LocalDateTime since = LocalDateTime.now().minusDays(1);

        long totalDecisions = learningEventRepository.countByEventTypeAndLearnedAtAfter("decision", since);
        long overrides = learningEventRepository.countByEventTypeAndLearnedAtAfter("override", since);

        double falsePositiveRate = totalDecisions > 0 ? (double) overrides / totalDecisions : 0;

        // Store global metrics
        AiPerformanceMetric metric = new AiPerformanceMetric();
        metric.setMetricDate(LocalDate.now().minusDays(1));
        metric.setTotalDecisions((int) totalDecisions);
        metric.setOverriddenDecisions((int) overrides);
        metric.setCorrectDecisions((int) (totalDecisions - overrides));
        metric.setFalsePositiveRate(falsePositiveRate);
        performanceRepository.save(metric);

        log.info("CORTEX: Self-evaluation complete — {} decisions, {} overrides, FP rate: {:.2%}",
                totalDecisions, overrides, falsePositiveRate);

        // Log adjustment event if FP rate is high
        if (falsePositiveRate > 0.15 && totalDecisions > 10) {
            AiLearningEvent adjustment = new AiLearningEvent();
            adjustment.setEventType("adjustment");
            adjustment.setOriginalVerdict("threshold_adjustment");
            adjustment.setCorrectedVerdict("FP rate " + String.format("%.1f%%", falsePositiveRate * 100));
            try {
                adjustment.setContext(objectMapper.writeValueAsString(Map.of(
                        "totalDecisions", totalDecisions,
                        "overrides", overrides,
                        "falsePositiveRate", falsePositiveRate,
                        "recommendation", "Increase confidence thresholds"
                )));
            } catch (Exception ignored) {}
            learningEventRepository.save(adjustment);
        }
    }

    // Daily cross-tenant pattern aggregation
    @Scheduled(cron = "0 30 2 * * *") // 2:30 AM daily
    @Transactional
    public void aggregateCrossTenantPatterns() {
        log.info("CORTEX: Aggregating cross-tenant patterns...");

        LocalDateTime since = LocalDateTime.now().minusDays(1);

        // Find IPs that attacked multiple companies in the last 24h
        try {
            List<Object[]> results = threatEventRepository.findCrossTenantAttackers(since);
            for (Object[] row : results) {
                String srcIp = (String) row[0];
                long companyCount = ((Number) row[1]).longValue();
                long eventCount = ((Number) row[2]).longValue();

                if (companyCount >= 2) {
                    // Check if pattern already exists
                    List<CrossTenantPattern> existing = patternRepository
                            .findByPatternTypeAndIsActiveTrue("ip_reputation");

                    boolean found = false;
                    for (CrossTenantPattern p : existing) {
                        try {
                            Map<String, Object> data = objectMapper.readValue(p.getPatternData(), Map.class);
                            if (srcIp.equals(data.get("ip"))) {
                                p.setSourceCount((int) companyCount);
                                p.setConfidence(Math.min(0.95, 0.5 + (companyCount * 0.15)));
                                p.setLastSeen(LocalDateTime.now());
                                patternRepository.save(p);
                                found = true;
                                break;
                            }
                        } catch (Exception ignored) {}
                    }

                    if (!found) {
                        CrossTenantPattern pattern = new CrossTenantPattern();
                        pattern.setPatternType("ip_reputation");
                        pattern.setConfidence(Math.min(0.95, 0.5 + (companyCount * 0.15)));
                        pattern.setSourceCount((int) companyCount);
                        try {
                            pattern.setPatternData(objectMapper.writeValueAsString(Map.of(
                                    "ip", srcIp,
                                    "attackedCompanies", companyCount,
                                    "totalEvents", eventCount
                            )));
                        } catch (Exception ignored) {}
                        patternRepository.save(pattern);
                    }
                }
            }
        } catch (Exception e) {
            log.error("CORTEX: Cross-tenant aggregation failed: {}", e.getMessage());
        }

        log.info("CORTEX: Cross-tenant pattern aggregation complete");
    }

    // Get active cross-tenant threats for a specific company (patterns from other tenants)
    public List<CrossTenantPattern> getActiveThreatPatterns(double minConfidence) {
        return patternRepository.findByConfidenceGreaterThanEqualAndIsActiveTrue(minConfidence);
    }

    // Get performance metrics for dashboard
    public List<AiPerformanceMetric> getPerformanceMetrics(String companyId, int days) {
        LocalDate from = LocalDate.now().minusDays(days);
        LocalDate to = LocalDate.now();
        if (companyId != null) {
            return performanceRepository.findByCompanyIdAndMetricDateBetweenOrderByMetricDateAsc(companyId, from, to);
        }
        return performanceRepository.findByCompanyIdIsNullAndMetricDateBetweenOrderByMetricDateAsc(from, to);
    }

    // Get learning events for review
    public List<AiLearningEvent> getLearningEvents(String companyId, int limit) {
        List<AiLearningEvent> events = learningEventRepository.findByCompanyIdOrderByLearnedAtDesc(companyId);
        return events.stream().limit(limit).collect(Collectors.toList());
    }

    // Get override stats
    public Map<String, Object> getOverrideStats(String companyId) {
        long decisions = learningEventRepository.countByCompanyIdAndEventType(companyId, "decision");
        long overrides = learningEventRepository.countByCompanyIdAndEventType(companyId, "override");
        double fpRate = decisions > 0 ? (double) overrides / decisions : 0;

        Map<String, Object> stats = new LinkedHashMap<>();
        stats.put("totalDecisions", decisions);
        stats.put("totalOverrides", overrides);
        stats.put("falsePositiveRate", fpRate);
        stats.put("accuracy", decisions > 0 ? 1.0 - fpRate : 1.0);
        return stats;
    }
}
