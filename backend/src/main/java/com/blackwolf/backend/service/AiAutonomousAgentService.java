package com.blackwolf.backend.service;

import com.blackwolf.backend.model.*;
import com.blackwolf.backend.repository.*;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentLinkedQueue;
import java.util.stream.Collectors;

@Service
public class AiAutonomousAgentService {

    private static final Logger log = LoggerFactory.getLogger(AiAutonomousAgentService.class);
    private static final String CLAUDE_API_URL = "https://api.anthropic.com/v1/messages";
    private static final int MAX_BATCH_SIZE = 25;

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final RestTemplate restTemplate = new RestTemplate();

    // Thread-safe queue for buffering incoming threats
    private final ConcurrentLinkedQueue<ThreatEvent> threatBuffer = new ConcurrentLinkedQueue<>();

    // In-memory noise pattern cache (refreshed from DB)
    private final ConcurrentHashMap<String, List<AiNoisePattern>> noisePatternCache = new ConcurrentHashMap<>();

    @Autowired private AiDecisionRepository decisionRepository;
    @Autowired private AiNoisePatternRepository noisePatternRepository;
    @Autowired private ThreatEventRepository threatEventRepository;
    @Autowired private IncidentService incidentService;
    @Autowired private BlockedIPRepository blockedIPRepository;
    @Autowired private PlaybookService playbookService;
    @Autowired private AlertService alertService;
    @Autowired private ThreatEnrichmentRepository enrichmentRepository;
    @Autowired private SseService sseService;
    @Autowired private CompanyRepository companyRepository;
    @Autowired private IncidentRepository incidentRepository;
    @Autowired(required = false) private com.blackwolf.backend.service.ai.CortexService cortexService;

    @Value("${ai.claude.api-key:}")
    private String apiKey;

    @Value("${ai.claude.model:claude-sonnet-4-20250514}")
    private String model;

    @Value("${ai.agent.autonomous.enabled:false}")
    private boolean autonomousEnabled;

    @Value("${ai.agent.autonomous.max-tokens:4096}")
    private int maxTokens;

    @Value("${ai.agent.autonomous.critical-threshold:8}")
    private int criticalThreshold;

    @Value("${ai.agent.autonomous.auto-block:true}")
    private boolean autoBlockEnabled;

    @Value("${ai.agent.autonomous.auto-incident:true}")
    private boolean autoIncidentEnabled;

    @Value("${ai.agent.autonomous.noise-learning:true}")
    private boolean noiseLearningEnabled;

    @Value("${ai.agent.slack-webhook:}")
    private String slackWebhook;

    @Value("${ai.agent.slack-enabled:false}")
    private boolean slackEnabled;

    // ===== PUBLIC API =====

    /**
     * Queue a new threat for AI analysis. Called from the threat ingestion pipeline.
     * Critical threats (severity >= threshold) are analyzed immediately.
     */
    public void queueThreat(ThreatEvent threat) {
        if (!autonomousEnabled || apiKey == null || apiKey.isBlank()) {
            return;
        }

        // Check noise suppression first
        if (isKnownNoise(threat)) {
            recordSuppressedDecision(threat);
            return;
        }

        // Critical threats get immediate analysis
        if (threat.getSeverity() != null && threat.getSeverity() >= criticalThreshold) {
            log.info("AI Agent: Immediate analysis for critical threat {} (severity {})",
                    threat.getId(), threat.getSeverity());
            sseService.emitAiAgentLog(threat.getCompanyId(), "WARN",
                    "IMMEDIATE_ANALYSIS", "Critical threat detected (severity " + threat.getSeverity() + ") from " + threat.getSrcIp() + " - " + threat.getThreatType() + ". Analyzing immediately...");
            analyzeImmediately(threat);
            return;
        }

        // Non-critical threats go to the buffer for batch processing
        threatBuffer.offer(threat);
        sseService.emitAiAgentLog(threat.getCompanyId(), "DEBUG",
                "QUEUED", "Threat " + threat.getId() + " queued for batch analysis (buffer: " + threatBuffer.size() + ")");
        log.debug("AI Agent: Threat {} queued for batch analysis (buffer size: {})",
                threat.getId(), threatBuffer.size());
    }

    // ===== SCHEDULED BATCH PROCESSING =====

    /**
     * Process buffered threats every 2 minutes.
     */
    @Scheduled(fixedDelayString = "${ai.agent.autonomous.batch-interval-ms:120000}")
    public void processBatch() {
        if (!autonomousEnabled || apiKey == null || apiKey.isBlank()) {
            return;
        }
        if (threatBuffer.isEmpty()) {
            return;
        }

        // Drain up to MAX_BATCH_SIZE threats
        List<ThreatEvent> batch = new ArrayList<>();
        while (!threatBuffer.isEmpty() && batch.size() < MAX_BATCH_SIZE) {
            ThreatEvent threat = threatBuffer.poll();
            if (threat != null) {
                batch.add(threat);
            }
        }

        if (batch.isEmpty()) {
            return;
        }

        // Group by company for multi-tenant analysis
        Map<String, List<ThreatEvent>> byCompany = batch.stream()
                .collect(Collectors.groupingBy(ThreatEvent::getCompanyId));

        for (Map.Entry<String, List<ThreatEvent>> entry : byCompany.entrySet()) {
            try {
                analyzeBatch(entry.getKey(), entry.getValue());
            } catch (Exception e) {
                log.error("AI Agent: Batch analysis failed for company {}: {}", entry.getKey(), e.getMessage());
            }
        }
    }

    /**
     * Refresh noise pattern cache from database every 5 minutes.
     */
    @Scheduled(fixedDelay = 300000)
    public void refreshNoisePatterns() {
        if (!autonomousEnabled) return;

        try {
            List<Company> companies = companyRepository.findAll();
            for (Company company : companies) {
                List<AiNoisePattern> patterns = noisePatternRepository
                        .findByCompanyIdAndIsActiveTrue(company.getId());

                // Remove expired patterns
                LocalDateTime now = LocalDateTime.now();
                patterns.removeIf(p -> p.getExpiresAt() != null && p.getExpiresAt().isBefore(now));

                noisePatternCache.put(company.getId(), patterns);
            }
        } catch (Exception e) {
            log.error("AI Agent: Failed to refresh noise patterns: {}", e.getMessage());
        }
    }

    // ===== CORE ANALYSIS =====

    /**
     * Immediate analysis for a single critical threat.
     */
    private void analyzeImmediately(ThreatEvent threat) {
        String batchId = UUID.randomUUID().toString();

        try {
            // Get enrichment context for this IP
            String enrichmentContext = getEnrichmentContext(threat.getSrcIp());

            // Get recent threat history for this IP
            String recentHistory = getRecentHistoryContext(threat.getCompanyId(), threat.getSrcIp());

            String systemPrompt = buildAnalysisSystemPrompt();
            String userPrompt = buildImmediateAnalysisPrompt(threat, enrichmentContext, recentHistory);

            Map<String, Object> apiResponse = callClaudeApi(systemPrompt, userPrompt);
            String content = extractContent(apiResponse);
            int tokensUsed = extractTokensUsed(apiResponse);

            // Parse the AI's decision
            ThreatAnalysis analysis = parseAnalysis(content, threat.getId());

            sseService.emitAiAgentLog(threat.getCompanyId(), "INFO",
                    "VERDICT", "Verdict for " + threat.getSrcIp() + ": " + analysis.verdict + " (confidence: " + Math.round(analysis.confidence * 100) + "%) - " + analysis.reasoning);

            // Execute the decision
            AiDecision decision = executeDecision(
                    threat.getCompanyId(), threat, analysis, batchId,
                    AiDecision.AnalysisMode.IMMEDIATE, tokensUsed);

            log.info("AI Agent: Immediate verdict for threat {} -> {} (confidence: {})",
                    threat.getId(), decision.getVerdict(), decision.getConfidence());

            // Per-event Slack notifications disabled.
            // Consolidated reports are sent every 6 hours by AiThreatAnalystService.

        } catch (Exception e) {
            log.error("AI Agent: Immediate analysis failed for threat {}: {}", threat.getId(), e.getMessage());
        }
    }

    /**
     * Batch analysis for multiple non-critical threats.
     */
    private void analyzeBatch(String companyId, List<ThreatEvent> threats) {
        String batchId = UUID.randomUUID().toString();

        log.info("AI Agent: Batch analysis for company {} ({} threats, batch {})",
                companyId, threats.size(), batchId);

        sseService.emitAiAgentLog(companyId, "INFO",
                "BATCH_START", "Batch analysis started: " + threats.size() + " threats (batch " + batchId.substring(0, 8) + ")");

        try {
            String systemPrompt = buildAnalysisSystemPrompt();
            String userPrompt = buildBatchAnalysisPrompt(companyId, threats);

            Map<String, Object> apiResponse = callClaudeApi(systemPrompt, userPrompt);
            String content = extractContent(apiResponse);
            int tokensUsed = extractTokensUsed(apiResponse);

            // Parse batch decisions
            List<ThreatAnalysis> analyses = parseBatchAnalysis(content, threats);

            // Execute each decision
            int tokensPerThreat = threats.isEmpty() ? 0 : tokensUsed / threats.size();
            for (int i = 0; i < analyses.size() && i < threats.size(); i++) {
                try {
                    AiDecision decision = executeDecision(
                            companyId, threats.get(i), analyses.get(i), batchId,
                            AiDecision.AnalysisMode.BATCH, tokensPerThreat);

                    // Per-event Slack notifications disabled.
                    // Consolidated reports sent every 6 hours.
                } catch (Exception e) {
                    log.error("AI Agent: Failed to execute decision for threat {}: {}",
                            threats.get(i).getId(), e.getMessage());
                }
            }

            sseService.emitAiAgentLog(companyId, "INFO",
                    "BATCH_COMPLETE", "Batch " + batchId.substring(0, 8) + " complete: " + threats.size() + " threats analyzed (" + tokensUsed + " tokens)");
            log.info("AI Agent: Batch {} complete - {} threats analyzed ({} tokens)",
                    batchId, threats.size(), tokensUsed);

        } catch (Exception e) {
            log.error("AI Agent: Batch analysis failed: {}", e.getMessage());
        }
    }

    // ===== DECISION EXECUTION =====

    private AiDecision executeDecision(String companyId, ThreatEvent threat,
                                        ThreatAnalysis analysis, String batchId,
                                        AiDecision.AnalysisMode mode, int tokensUsed) {
        AiDecision decision = new AiDecision();
        decision.setId(UUID.randomUUID().toString());
        decision.setCompanyId(companyId);
        decision.setThreatEventId(threat.getId());
        decision.setVerdict(analysis.verdict);
        decision.setConfidence(BigDecimal.valueOf(analysis.confidence));
        decision.setReasoning(analysis.reasoning);
        decision.setBatchId(batchId);
        decision.setAnalysisMode(mode);
        decision.setTokensUsed(tokensUsed);
        decision.setIpBlocked(false);
        decision.setCreatedAt(LocalDateTime.now());

        List<String> actionsExecuted = new ArrayList<>();

        switch (analysis.verdict) {
            case NOISE, FALSE_POSITIVE -> {
                // Mark threat as false positive
                threat.setStatus("FALSE_POSITIVE");
                threatEventRepository.save(threat);
                decision.setThreatStatusUpdated("FALSE_POSITIVE");
                actionsExecuted.add("threat_marked_false_positive");
                sseService.emitAiAgentLog(companyId, "DEBUG",
                        "DISMISSED", "Threat from " + threat.getSrcIp() + " marked as " + analysis.verdict + " - " + threat.getThreatType());

                // Learn noise pattern
                if (noiseLearningEnabled && analysis.verdict == AiDecision.Verdict.NOISE) {
                    learnNoisePattern(companyId, threat, analysis.reasoning);
                    actionsExecuted.add("noise_pattern_learned");
                    sseService.emitAiAgentLog(companyId, "INFO",
                            "NOISE_LEARNED", "Noise pattern learned: " + threat.getSrcIp() + " / " + threat.getThreatType());
                }
            }

            case LEGITIMATE_SCAN -> {
                // Mark as acknowledged but not a real threat
                threat.setStatus("RESOLVED");
                threatEventRepository.save(threat);
                decision.setThreatStatusUpdated("RESOLVED");
                actionsExecuted.add("threat_marked_resolved_scan");
                sseService.emitAiAgentLog(companyId, "DEBUG",
                        "SCAN_RESOLVED", "Legitimate scan from " + threat.getSrcIp() + " resolved - " + threat.getThreatType());
            }

            case SUSPICIOUS -> {
                // Escalate the threat status
                threat.setStatus("ESCALATED");
                threatEventRepository.save(threat);
                decision.setThreatStatusUpdated("ESCALATED");
                actionsExecuted.add("threat_escalated");
                sseService.emitAiAgentLog(companyId, "WARN",
                        "ESCALATED", "Suspicious activity from " + threat.getSrcIp() + " escalated - " + threat.getThreatType());

                // Create or deduplicate incident
                if (autoIncidentEnabled) {
                    try {
                        Incident incident = deduplicateOrCreateIncident(
                                companyId, threat, analysis, "medium", actionsExecuted);
                        decision.setIncidentCreatedId(incident.getId());

                        incidentService.addTimelineEntry(incident.getId(), "AI Analysis",
                                "Verdict: " + analysis.verdict + " | Confidence: " + Math.round(analysis.confidence * 100) + "%\nReasoning: " + analysis.reasoning, "ai-agent");
                        incidentService.addTimelineEntry(incident.getId(), "Threat Escalated",
                                "Threat " + threat.getId() + " escalated for further investigation", "ai-agent");
                    } catch (Exception e) {
                        log.error("AI Agent: Failed to create incident: {}", e.getMessage());
                    }
                }
            }

            case REAL_ATTACK -> {
                // Escalate
                threat.setStatus("ESCALATED");
                threatEventRepository.save(threat);
                decision.setThreatStatusUpdated("ESCALATED");
                actionsExecuted.add("threat_escalated");
                sseService.emitAiAgentLog(companyId, "ERROR",
                        "REAL_ATTACK", "REAL ATTACK detected from " + threat.getSrcIp() + " - " + threat.getThreatType() + " (severity " + threat.getSeverity() + ")");

                // Create or deduplicate incident
                if (autoIncidentEnabled) {
                    try {
                        Incident incident = deduplicateOrCreateIncident(
                                companyId, threat, analysis, "high", actionsExecuted);
                        decision.setIncidentCreatedId(incident.getId());

                        incidentService.addTimelineEntry(incident.getId(), "AI Analysis",
                                "Verdict: " + analysis.verdict + " | Confidence: " + Math.round(analysis.confidence * 100) + "%\nReasoning: " + analysis.reasoning, "ai-agent");

                        alertService.fireAlertsForIncident(companyId, incident.getId(),
                                incident.getTitle(), incident.getSeverity());
                        actionsExecuted.add("alerts_fired");
                        sseService.emitAiAgentLog(companyId, "WARN",
                                "ALERTS_FIRED", "Alerts dispatched for real attack incident");

                        incidentService.addTimelineEntry(incident.getId(), "Alerts Fired",
                                "Alerts dispatched for incident", "ai-agent");
                    } catch (Exception e) {
                        log.error("AI Agent: Failed to create incident for real attack: {}", e.getMessage());
                    }
                }

                // Block the IP
                if (autoBlockEnabled && threat.getSrcIp() != null) {
                    blockIp(companyId, threat.getSrcIp(),
                            "AI Agent: Real attack detected - " + threat.getThreatType(), 48);
                    decision.setIpBlocked(true);
                    actionsExecuted.add("ip_blocked:" + threat.getSrcIp());
                    sseService.emitAiAgentLog(companyId, "ERROR",
                            "IP_BLOCKED", "IP " + threat.getSrcIp() + " blocked for 48 hours - Real attack: " + threat.getThreatType());

                    if (decision.getIncidentCreatedId() != null) {
                        incidentService.addTimelineEntry(decision.getIncidentCreatedId(), "IP Blocked",
                                "Blocked IP " + threat.getSrcIp() + " for 48 hours. Reason: Real attack detected - " + threat.getThreatType(), "ai-agent");
                    }
                }

                // Trigger relevant playbooks
                try {
                    playbookService.triggerForThreat(threat);
                    actionsExecuted.add("playbooks_triggered");
                    sseService.emitAiAgentLog(companyId, "INFO",
                            "PLAYBOOK_TRIGGERED", "Automated playbooks triggered for " + threat.getThreatType());

                    if (decision.getIncidentCreatedId() != null) {
                        incidentService.addTimelineEntry(decision.getIncidentCreatedId(), "Playbook Triggered",
                                "Automated playbooks triggered for threat type: " + threat.getThreatType(), "ai-agent");
                    }
                } catch (Exception e) {
                    log.error("AI Agent: Failed to trigger playbooks: {}", e.getMessage());
                }
            }

            case CRITICAL_ATTACK -> {
                // Maximum response
                threat.setStatus("ESCALATED");
                threatEventRepository.save(threat);
                decision.setThreatStatusUpdated("ESCALATED");
                actionsExecuted.add("threat_escalated_critical");
                sseService.emitAiAgentLog(companyId, "CRITICAL",
                        "CRITICAL_ATTACK", "CRITICAL ATTACK from " + threat.getSrcIp() + " - " + threat.getThreatType() + " (severity " + threat.getSeverity() + "). Maximum response initiated.");

                // Create or deduplicate critical incident
                if (autoIncidentEnabled) {
                    try {
                        Incident incident = deduplicateOrCreateIncident(
                                companyId, threat, analysis, "critical", actionsExecuted);
                        decision.setIncidentCreatedId(incident.getId());

                        incidentService.addTimelineEntry(incident.getId(), "AI Analysis",
                                "Verdict: CRITICAL_ATTACK | Confidence: " + Math.round(analysis.confidence * 100) + "%\nReasoning: " + analysis.reasoning, "ai-agent");

                        alertService.fireAlertsForIncident(companyId, incident.getId(),
                                incident.getTitle(), "critical");
                        actionsExecuted.add("critical_alerts_fired");
                        sseService.emitAiAgentLog(companyId, "CRITICAL",
                                "CRITICAL_ALERTS", "Critical alerts dispatched for attack from " + threat.getSrcIp());

                        incidentService.addTimelineEntry(incident.getId(), "Critical Alerts Fired",
                                "Critical alerts dispatched for incident", "ai-agent");
                    } catch (Exception e) {
                        log.error("AI Agent: Failed to create critical incident: {}", e.getMessage());
                    }
                }

                // Block IP for longer duration
                if (autoBlockEnabled && threat.getSrcIp() != null) {
                    blockIp(companyId, threat.getSrcIp(),
                            "AI Agent: CRITICAL ATTACK - " + threat.getThreatType(), 168); // 7 days
                    decision.setIpBlocked(true);
                    actionsExecuted.add("ip_blocked_7days:" + threat.getSrcIp());
                    sseService.emitAiAgentLog(companyId, "CRITICAL",
                            "IP_BLOCKED", "IP " + threat.getSrcIp() + " blocked for 7 DAYS - Critical attack: " + threat.getThreatType());

                    if (decision.getIncidentCreatedId() != null) {
                        incidentService.addTimelineEntry(decision.getIncidentCreatedId(), "IP Blocked",
                                "Blocked IP " + threat.getSrcIp() + " for 7 days. Reason: CRITICAL ATTACK - " + threat.getThreatType(), "ai-agent");
                    }
                }

                // Trigger playbooks
                try {
                    playbookService.triggerForThreat(threat);
                    actionsExecuted.add("playbooks_triggered");
                    sseService.emitAiAgentLog(companyId, "INFO",
                            "PLAYBOOK_TRIGGERED", "Automated playbooks triggered for " + threat.getThreatType());

                    if (decision.getIncidentCreatedId() != null) {
                        incidentService.addTimelineEntry(decision.getIncidentCreatedId(), "Playbook Triggered",
                                "Automated playbooks triggered for threat type: " + threat.getThreatType(), "ai-agent");
                    }
                } catch (Exception e) {
                    log.error("AI Agent: Failed to trigger playbooks: {}", e.getMessage());
                }
            }
        }

        try {
            decision.setActionsTaken(objectMapper.writeValueAsString(actionsExecuted));
        } catch (Exception e) {
            decision.setActionsTaken(actionsExecuted.toString());
        }

        decisionRepository.save(decision);

        // Record decision in Cortex for learning
        if (cortexService != null) {
            try {
                cortexService.recordDecision(companyId, decision.getVerdict().name(),
                        threat.getThreatType(), threat.getId(),
                        decision.getConfidence() != null ? decision.getConfidence().doubleValue() : null,
                        Map.of("severity", threat.getSeverity(), "srcIp", String.valueOf(threat.getSrcIp())));
            } catch (Exception ignored) {}
        }

        // Emit SSE event for dashboard update
        sseService.emitDashboardUpdate(companyId);

        return decision;
    }

    // ===== INCIDENT DEDUPLICATION =====

    private Incident deduplicateOrCreateIncident(String companyId, ThreatEvent threat,
                                                   ThreatAnalysis analysis, String newSeverity,
                                                   List<String> actionsExecuted) {
        if (threat.getSrcIp() != null) {
            List<Incident> existing = incidentRepository.findOpenBySourceIp(companyId, threat.getSrcIp());
            if (!existing.isEmpty()) {
                Incident incident = existing.get(0);
                // Escalate severity if new event is more severe
                if (compareSeverity(newSeverity, incident.getSeverity()) > 0) {
                    incident.setSeverity(newSeverity);
                    incident.setUpdatedAt(LocalDateTime.now());
                    incidentRepository.save(incident);
                }
                incidentService.addTimelineEntry(incident.getId(), "Correlated Event",
                        "New threat from same IP " + threat.getSrcIp() + ": " + threat.getThreatType()
                                + " (severity " + threat.getSeverity() + "). AI verdict: " + analysis.verdict, "ai-agent");
                actionsExecuted.add("incident_escalated:" + incident.getId());
                sseService.emitAiAgentLog(companyId, "INFO",
                        "INCIDENT_CORRELATED", "Correlated to existing incident " + incident.getId().substring(0, 8) + " for IP " + threat.getSrcIp());
                return incident;
            }
        }

        // No existing incident, create new
        String description = analysis.verdict == AiDecision.Verdict.CRITICAL_ATTACK
                ? "[AI AGENT - CRITICAL ATTACK DETECTED]\n\n" + analysis.reasoning + "\n\nConfidence: " + analysis.confidence
                : "[AI Agent" + (analysis.verdict == AiDecision.Verdict.REAL_ATTACK ? " - REAL ATTACK" : "") + "] " + analysis.reasoning;
        int severity = analysis.verdict == AiDecision.Verdict.CRITICAL_ATTACK ? 10 : threat.getSeverity();
        Incident incident = incidentService.createFromThreat(companyId, threat.getId(), threat.getThreatType(), severity, description);
        actionsExecuted.add("incident_created:" + incident.getId());
        sseService.emitAiAgentLog(companyId, "WARN",
                "INCIDENT_CREATED", "Incident created for " + analysis.verdict + " from " + threat.getSrcIp());
        return incident;
    }

    private static int severityRank(String severity) {
        if (severity == null) return 0;
        return switch (severity.toLowerCase()) {
            case "critical" -> 4;
            case "high" -> 3;
            case "medium" -> 2;
            case "low" -> 1;
            default -> 0;
        };
    }

    private static int compareSeverity(String a, String b) {
        return Integer.compare(severityRank(a), severityRank(b));
    }

    // ===== NOISE SUPPRESSION =====

    private boolean isKnownNoise(ThreatEvent threat) {
        List<AiNoisePattern> patterns = noisePatternCache.get(threat.getCompanyId());
        if (patterns == null || patterns.isEmpty()) {
            return false;
        }

        for (AiNoisePattern pattern : patterns) {
            boolean matches = true;

            if (pattern.getSrcIp() != null && !pattern.getSrcIp().isBlank()) {
                matches = pattern.getSrcIp().equals(threat.getSrcIp());
            }
            if (matches && pattern.getThreatType() != null && !pattern.getThreatType().isBlank()) {
                matches = pattern.getThreatType().equalsIgnoreCase(threat.getThreatType());
            }
            if (matches && pattern.getDstPort() != null) {
                matches = pattern.getDstPort().equals(threat.getDstPort());
            }
            if (matches && pattern.getDescriptionPattern() != null && !pattern.getDescriptionPattern().isBlank()) {
                String desc = threat.getDescription();
                matches = desc != null && desc.toLowerCase().contains(pattern.getDescriptionPattern().toLowerCase());
            }

            if (matches) {
                // Update suppression count
                pattern.setSuppressedCount(pattern.getSuppressedCount() + 1);
                pattern.setLastSeen(LocalDateTime.now());
                noisePatternRepository.save(pattern);
                return true;
            }
        }

        return false;
    }

    private void recordSuppressedDecision(ThreatEvent threat) {
        AiDecision decision = new AiDecision();
        decision.setId(UUID.randomUUID().toString());
        decision.setCompanyId(threat.getCompanyId());
        decision.setThreatEventId(threat.getId());
        decision.setVerdict(AiDecision.Verdict.NOISE);
        decision.setConfidence(BigDecimal.valueOf(0.95));
        decision.setReasoning("Auto-suppressed: matches known noise pattern");
        decision.setAnalysisMode(AiDecision.AnalysisMode.SUPPRESSED);
        decision.setTokensUsed(0);
        decision.setIpBlocked(false);
        decision.setCreatedAt(LocalDateTime.now());

        // Mark threat as false positive
        threat.setStatus("FALSE_POSITIVE");
        threatEventRepository.save(threat);
        decision.setThreatStatusUpdated("FALSE_POSITIVE");
        decision.setActionsTaken("[\"auto_suppressed\",\"threat_marked_false_positive\"]");

        decisionRepository.save(decision);

        log.debug("AI Agent: Threat {} auto-suppressed by noise pattern", threat.getId());
    }

    private void learnNoisePattern(String companyId, ThreatEvent threat, String reasoning) {
        // Only learn patterns for specific IP + type combinations
        if (threat.getSrcIp() == null || threat.getThreatType() == null) {
            return;
        }

        // Check if pattern already exists
        List<AiNoisePattern> existing = noisePatternRepository
                .findByCompanyIdAndSrcIpAndIsActiveTrue(companyId, threat.getSrcIp());
        for (AiNoisePattern p : existing) {
            if (threat.getThreatType().equalsIgnoreCase(p.getThreatType())) {
                // Pattern already learned
                return;
            }
        }

        AiNoisePattern pattern = new AiNoisePattern();
        pattern.setId(UUID.randomUUID().toString());
        pattern.setCompanyId(companyId);
        pattern.setSrcIp(threat.getSrcIp());
        pattern.setThreatType(threat.getThreatType());
        pattern.setReason("AI learned: " + reasoning);
        pattern.setSuppressedCount(0);
        pattern.setIsActive(true);
        // Noise patterns expire after 7 days to allow re-evaluation
        pattern.setExpiresAt(LocalDateTime.now().plusDays(7));
        pattern.setCreatedAt(LocalDateTime.now());
        pattern.setCreatedBy("ai-agent");

        noisePatternRepository.save(pattern);

        // Update cache
        noisePatternCache.computeIfAbsent(companyId, k -> new ArrayList<>()).add(pattern);

        log.info("AI Agent: Learned noise pattern - {}:{} for company {}",
                threat.getSrcIp(), threat.getThreatType(), companyId);
    }

    // ===== PROMPT BUILDING =====

    private String buildAnalysisSystemPrompt() {
        return """
                Eres el motor de decisiones autónomo del SOC de BlackWolf Security. Tu trabajo es analizar amenazas \
                en tiempo real y tomar decisiones de respuesta inmediata.

                DEBES responder EXCLUSIVAMENTE en formato JSON válido. No incluyas texto antes o después del JSON.

                Para cada amenaza, clasifica con uno de estos veredictos:
                - NOISE: Tráfico normal o ruido de red sin riesgo (ej: escaneos de puertos aleatorios de bots conocidos, \
                peticiones HTTP normales que triggerearon una regla demasiado sensible)
                - FALSE_POSITIVE: La detección es incorrecta, no hay actividad maliciosa real
                - LEGITIMATE_SCAN: Escaneo automatizado de bajo riesgo (bots de search engines, scanners de seguridad conocidos, \
                scanners shodan/censys)
                - SUSPICIOUS: Actividad que necesita vigilancia pero no es claramente un ataque activo
                - REAL_ATTACK: Ataque real confirmado que requiere respuesta (ej: SQL injection con payloads reales, \
                brute force sostenido, exploit attempts con payloads funcionales)
                - CRITICAL_ATTACK: Ataque crítico que indica compromiso activo o intento de compromiso sofisticado

                Criterios de decisión:
                1. Un escaneo automatizado de un bot desde Europa del Este NO es lo mismo que un ataque dirigido
                2. SQL injection con payloads genéricos tipo "' OR 1=1--" suelen ser scanners automatizados = LEGITIMATE_SCAN
                3. SQL injection con payloads específicos para tu aplicación = REAL_ATTACK
                4. Brute force con 3-5 intentos = NOISE, con 50+ intentos sostenidos = REAL_ATTACK
                5. Exploit attempts con payloads genéricos de Metasploit = LEGITIMATE_SCAN
                6. Cualquier indicio de shell reverse, webshell, o exfiltración = CRITICAL_ATTACK
                7. La IP origen, país, ISP y historial de abuso son factores importantes

                Formato de respuesta para UN threat:
                ```json
                {
                  "threat_id": "el-id-del-threat",
                  "verdict": "NOISE|FALSE_POSITIVE|LEGITIMATE_SCAN|SUSPICIOUS|REAL_ATTACK|CRITICAL_ATTACK",
                  "confidence": 0.85,
                  "reasoning": "Explicación concisa de por qué esta decisión"
                }
                ```

                Formato de respuesta para MÚLTIPLES threats (batch):
                ```json
                {
                  "analyses": [
                    {
                      "threat_id": "id-1",
                      "verdict": "NOISE",
                      "confidence": 0.90,
                      "reasoning": "..."
                    },
                    {
                      "threat_id": "id-2",
                      "verdict": "REAL_ATTACK",
                      "confidence": 0.75,
                      "reasoning": "..."
                    }
                  ]
                }
                ```
                """;
    }

    private String buildImmediateAnalysisPrompt(ThreatEvent threat, String enrichment, String history) {
        StringBuilder prompt = new StringBuilder();
        prompt.append("ANÁLISIS INMEDIATO - AMENAZA CRÍTICA\n\n");
        prompt.append("Threat ID: ").append(threat.getId()).append("\n");
        prompt.append("Tipo: ").append(threat.getThreatType()).append("\n");
        prompt.append("Severidad: ").append(threat.getSeverity()).append("/10\n");
        prompt.append("IP Origen: ").append(threat.getSrcIp()).append("\n");
        prompt.append("IP Destino: ").append(threat.getDstIp()).append("\n");
        prompt.append("Puerto Destino: ").append(threat.getDstPort()).append("\n");
        prompt.append("Timestamp: ").append(threat.getTimestamp()).append("\n");
        prompt.append("Descripción: ").append(threat.getDescription()).append("\n\n");

        if (enrichment != null && !enrichment.isBlank()) {
            prompt.append("=== INTELIGENCIA DE IP ===\n").append(enrichment).append("\n\n");
        }
        if (history != null && !history.isBlank()) {
            prompt.append("=== HISTORIAL RECIENTE DE ESTA IP ===\n").append(history).append("\n\n");
        }

        prompt.append("Analiza esta amenaza y responde con el JSON de decisión.");
        return prompt.toString();
    }

    private String buildBatchAnalysisPrompt(String companyId, List<ThreatEvent> threats) {
        StringBuilder prompt = new StringBuilder();
        prompt.append("ANÁLISIS BATCH - ").append(threats.size()).append(" amenazas\n\n");

        for (int i = 0; i < threats.size(); i++) {
            ThreatEvent t = threats.get(i);
            prompt.append("--- Threat #").append(i + 1).append(" ---\n");
            prompt.append("ID: ").append(t.getId()).append("\n");
            prompt.append("Tipo: ").append(t.getThreatType()).append("\n");
            prompt.append("Severidad: ").append(t.getSeverity()).append("/10\n");
            prompt.append("IP Origen: ").append(t.getSrcIp()).append("\n");
            prompt.append("IP Destino: ").append(t.getDstIp()).append("\n");
            prompt.append("Puerto: ").append(t.getDstPort()).append("\n");
            prompt.append("Timestamp: ").append(t.getTimestamp()).append("\n");
            prompt.append("Descripción: ").append(t.getDescription() != null ? t.getDescription() : "N/A").append("\n");

            // Add enrichment if available
            String enrichment = getEnrichmentContext(t.getSrcIp());
            if (enrichment != null && !enrichment.isBlank()) {
                prompt.append("Intel IP: ").append(enrichment).append("\n");
            }
            prompt.append("\n");
        }

        prompt.append("Analiza TODAS las amenazas y responde con el JSON batch de decisiones.");
        return prompt.toString();
    }

    // ===== CONTEXT HELPERS =====

    private String getEnrichmentContext(String ip) {
        if (ip == null) return null;
        try {
            Optional<ThreatEnrichment> enrichment = enrichmentRepository.findById(ip);
            if (enrichment.isPresent()) {
                ThreatEnrichment e = enrichment.get();
                return String.format("País: %s | ISP: %s | Abuse Score: %d | Tor: %s | VPN: %s | Reports: %d",
                        e.getCountryCode(), e.getIsp(), e.getAbuseConfidenceScore(),
                        e.isTor(), e.isVpn(), e.getTotalReports());
            }
        } catch (Exception e) {
            log.debug("AI Agent: Enrichment lookup failed for {}: {}", ip, e.getMessage());
        }
        return null;
    }

    private String getRecentHistoryContext(String companyId, String srcIp) {
        if (srcIp == null) return null;
        try {
            LocalDateTime oneHourAgo = LocalDateTime.now().minusHours(1);
            List<ThreatEvent> recent = threatEventRepository.findByCompanyId(companyId)
                    .stream()
                    .filter(t -> srcIp.equals(t.getSrcIp()) && t.getTimestamp() != null
                            && t.getTimestamp().isAfter(oneHourAgo))
                    .sorted((a, b) -> b.getTimestamp().compareTo(a.getTimestamp()))
                    .limit(10)
                    .collect(Collectors.toList());

            if (recent.isEmpty()) return null;

            StringBuilder ctx = new StringBuilder();
            ctx.append("Últimos ").append(recent.size()).append(" eventos de ").append(srcIp).append(" (1h):\n");
            for (ThreatEvent t : recent) {
                ctx.append("  - [Sev ").append(t.getSeverity()).append("] ")
                        .append(t.getThreatType())
                        .append(" → ").append(t.getDstIp()).append(":").append(t.getDstPort())
                        .append(" | ").append(t.getStatus())
                        .append(" | ").append(t.getTimestamp())
                        .append("\n");
            }
            return ctx.toString();
        } catch (Exception e) {
            return null;
        }
    }

    // ===== RESPONSE PARSING =====

    private ThreatAnalysis parseAnalysis(String content, String expectedThreatId) {
        try {
            // Strip markdown code blocks if present
            String json = cleanJsonResponse(content);
            JsonNode root = objectMapper.readTree(json);

            ThreatAnalysis analysis = new ThreatAnalysis();
            analysis.threatId = root.has("threat_id") ? root.get("threat_id").asText() : expectedThreatId;
            analysis.verdict = AiDecision.Verdict.valueOf(root.get("verdict").asText().toUpperCase());
            analysis.confidence = root.get("confidence").asDouble();
            analysis.reasoning = root.get("reasoning").asText();
            return analysis;
        } catch (Exception e) {
            log.warn("AI Agent: Failed to parse AI response, defaulting to SUSPICIOUS: {}", e.getMessage());
            ThreatAnalysis fallback = new ThreatAnalysis();
            fallback.threatId = expectedThreatId;
            fallback.verdict = AiDecision.Verdict.SUSPICIOUS;
            fallback.confidence = 0.5;
            fallback.reasoning = "Parse error - defaulted to suspicious. Raw response: "
                    + (content != null ? content.substring(0, Math.min(content.length(), 200)) : "null");
            return fallback;
        }
    }

    private List<ThreatAnalysis> parseBatchAnalysis(String content, List<ThreatEvent> threats) {
        List<ThreatAnalysis> results = new ArrayList<>();

        try {
            String json = cleanJsonResponse(content);
            JsonNode root = objectMapper.readTree(json);

            JsonNode analyses = root.has("analyses") ? root.get("analyses") : root;

            if (analyses.isArray()) {
                for (JsonNode node : analyses) {
                    ThreatAnalysis analysis = new ThreatAnalysis();
                    analysis.threatId = node.has("threat_id") ? node.get("threat_id").asText() : "";
                    analysis.verdict = AiDecision.Verdict.valueOf(node.get("verdict").asText().toUpperCase());
                    analysis.confidence = node.get("confidence").asDouble();
                    analysis.reasoning = node.get("reasoning").asText();
                    results.add(analysis);
                }
            }
        } catch (Exception e) {
            log.warn("AI Agent: Failed to parse batch response: {}", e.getMessage());
        }

        // Ensure we have one analysis per threat (fill gaps with SUSPICIOUS)
        while (results.size() < threats.size()) {
            ThreatAnalysis fallback = new ThreatAnalysis();
            fallback.threatId = threats.get(results.size()).getId();
            fallback.verdict = AiDecision.Verdict.SUSPICIOUS;
            fallback.confidence = 0.5;
            fallback.reasoning = "No analysis returned by AI for this threat";
            results.add(fallback);
        }

        return results;
    }

    private String cleanJsonResponse(String content) {
        if (content == null) return "{}";
        String cleaned = content.trim();
        // Remove markdown code blocks
        if (cleaned.startsWith("```json")) {
            cleaned = cleaned.substring(7);
        } else if (cleaned.startsWith("```")) {
            cleaned = cleaned.substring(3);
        }
        if (cleaned.endsWith("```")) {
            cleaned = cleaned.substring(0, cleaned.length() - 3);
        }
        return cleaned.trim();
    }

    // ===== CLAUDE API =====

    @SuppressWarnings("unchecked")
    private Map<String, Object> callClaudeApi(String systemPrompt, String userMessage) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("x-api-key", apiKey);
        headers.set("anthropic-version", "2023-06-01");

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("model", model);
        body.put("max_tokens", maxTokens);
        body.put("system", systemPrompt);
        body.put("messages", List.of(Map.of("role", "user", "content", userMessage)));

        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(body, headers);

        ResponseEntity<Map> response = restTemplate.exchange(
                CLAUDE_API_URL, HttpMethod.POST, entity, Map.class);

        return response.getBody();
    }

    @SuppressWarnings("unchecked")
    private String extractContent(Map<String, Object> apiResponse) {
        if (apiResponse == null) return null;
        List<Map<String, Object>> content = (List<Map<String, Object>>) apiResponse.get("content");
        if (content != null && !content.isEmpty()) {
            return (String) content.get(0).get("text");
        }
        return null;
    }

    @SuppressWarnings("unchecked")
    private int extractTokensUsed(Map<String, Object> apiResponse) {
        if (apiResponse == null) return 0;
        Map<String, Object> usage = (Map<String, Object>) apiResponse.get("usage");
        if (usage != null) {
            Object outputTokens = usage.get("output_tokens");
            if (outputTokens instanceof Number) {
                return ((Number) outputTokens).intValue();
            }
        }
        return 0;
    }

    // ===== HELPERS =====

    private void blockIp(String companyId, String ip, String reason, int hours) {
        try {
            BlockedIPId id = new BlockedIPId();
            id.setIp(ip);
            id.setCompanyId(companyId);

            if (!blockedIPRepository.existsById(id)) {
                BlockedIP blocked = new BlockedIP();
                blocked.setIp(ip);
                blocked.setCompanyId(companyId);
                blocked.setReason(reason);
                blocked.setBlockedAt(LocalDateTime.now());
                blocked.setExpiresAt(LocalDateTime.now().plusHours(hours));
                blockedIPRepository.save(blocked);
                log.info("AI Agent: Blocked IP {} for {} hours - {}", ip, hours, reason);
            }
        } catch (org.springframework.dao.DataIntegrityViolationException e) {
            log.debug("AI Agent: IP {} already blocked for company {}", ip, companyId);
        } catch (Exception e) {
            log.error("AI Agent: Failed to block IP {}: {}", ip, e.getMessage());
        }
    }

    private boolean isActionableVerdict(AiDecision.Verdict verdict) {
        return verdict == AiDecision.Verdict.SUSPICIOUS
                || verdict == AiDecision.Verdict.REAL_ATTACK
                || verdict == AiDecision.Verdict.CRITICAL_ATTACK;
    }

    // ===== SLACK NOTIFICATIONS =====

    private void sendSlackDecisionNotification(AiDecision decision, ThreatEvent threat) {
        if (!slackEnabled || slackWebhook == null || slackWebhook.isBlank()) return;

        String emoji = switch (decision.getVerdict()) {
            case CRITICAL_ATTACK -> ":rotating_light:";
            case REAL_ATTACK -> ":red_circle:";
            case SUSPICIOUS -> ":warning:";
            default -> ":information_source:";
        };

        String text = String.format("""
                %s *AI AGENT - %s*
                *Amenaza:* %s (Severidad %d/10)
                *IP:* `%s` → `%s:%d`
                *Confianza:* %.0f%%
                *Razonamiento:* %s
                *Acciones:* %s""",
                emoji, decision.getVerdict(),
                threat.getThreatType(), threat.getSeverity(),
                threat.getSrcIp(), threat.getDstIp(), threat.getDstPort(),
                decision.getConfidence().doubleValue() * 100,
                decision.getReasoning(),
                decision.getActionsTaken());

        try {
            Map<String, String> payload = Map.of("text", text);
            restTemplate.postForEntity(slackWebhook, payload, String.class);
        } catch (Exception e) {
            log.error("AI Agent: Slack notification failed: {}", e.getMessage());
        }
    }

    // ===== STATISTICS =====

    public Map<String, Object> getStats(String companyId) {
        Map<String, Object> stats = new LinkedHashMap<>();

        LocalDateTime last24h = LocalDateTime.now().minusHours(24);
        LocalDateTime last7d = LocalDateTime.now().minusDays(7);

        stats.put("totalDecisions", decisionRepository.countByCompanyIdAndCreatedAtAfter(companyId, last24h));
        stats.put("activeNoisePatterns", noisePatternRepository.findByCompanyIdAndIsActiveTrue(companyId).size());
        stats.put("bufferSize", threatBuffer.size());
        stats.put("autonomousEnabled", autonomousEnabled);

        // Verdict breakdown
        List<Object[]> verdictCounts = decisionRepository.countByVerdictSince(companyId, last24h);
        Map<String, Long> byVerdict = new LinkedHashMap<>();
        for (Object[] row : verdictCounts) {
            byVerdict.put(row[0].toString(), (Long) row[1]);
        }
        stats.put("verdictBreakdown24h", byVerdict);

        // 7-day verdict breakdown
        List<Object[]> verdictCounts7d = decisionRepository.countByVerdictSince(companyId, last7d);
        Map<String, Long> byVerdict7d = new LinkedHashMap<>();
        for (Object[] row : verdictCounts7d) {
            byVerdict7d.put(row[0].toString(), (Long) row[1]);
        }
        stats.put("verdictBreakdown7d", byVerdict7d);

        return stats;
    }

    public List<AiDecision> getDecisions(String companyId, String verdict) {
        if (verdict != null && !verdict.isBlank()) {
            return decisionRepository.findByCompanyIdAndVerdictOrderByCreatedAtDesc(
                    companyId, AiDecision.Verdict.valueOf(verdict.toUpperCase()));
        }
        return decisionRepository.findByCompanyIdOrderByCreatedAtDesc(companyId);
    }

    public List<AiNoisePattern> getNoisePatterns(String companyId) {
        return noisePatternRepository.findByCompanyIdOrderByCreatedAtDesc(companyId);
    }

    public void toggleNoisePattern(String patternId, boolean active) {
        noisePatternRepository.findById(patternId).ifPresent(p -> {
            p.setIsActive(active);
            noisePatternRepository.save(p);
        });
    }

    public void deleteNoisePattern(String patternId) {
        noisePatternRepository.deleteById(patternId);
    }

    // ===== TOKEN STATISTICS =====

    public Map<String, Object> getTokenStats(String companyId) {
        Map<String, Object> stats = new LinkedHashMap<>();

        long totalTokens = decisionRepository.sumTokensByCompanyId(companyId);
        stats.put("totalTokens", totalTokens);

        LocalDateTime now = LocalDateTime.now();
        stats.put("tokens24h", decisionRepository.sumTokensSince(companyId, now.minusHours(24)));
        stats.put("tokens7d", decisionRepository.sumTokensSince(companyId, now.minusDays(7)));
        stats.put("tokens30d", decisionRepository.sumTokensSince(companyId, now.minusDays(30)));

        stats.put("avgTokensPerDecision", decisionRepository.avgTokensPerDecision(companyId));

        // Verdict breakdown: verdict -> { tokens, count }
        List<Object[]> breakdown = decisionRepository.tokenBreakdownByVerdict(companyId);
        List<Map<String, Object>> verdictBreakdown = new ArrayList<>();
        for (Object[] row : breakdown) {
            Map<String, Object> entry = new LinkedHashMap<>();
            entry.put("verdict", row[0].toString());
            entry.put("tokens", ((Number) row[1]).longValue());
            entry.put("count", ((Number) row[2]).longValue());
            verdictBreakdown.add(entry);
        }
        stats.put("verdictBreakdown", verdictBreakdown);

        // Estimated cost: Sonnet 4 pricing ($3/1M input, $15/1M output)
        // Assume ~75% input, ~25% output tokens ratio
        double inputTokens = totalTokens * 0.75;
        double outputTokens = totalTokens * 0.25;
        double estimatedCost = (inputTokens / 1_000_000.0) * 3.0 + (outputTokens / 1_000_000.0) * 15.0;
        stats.put("estimatedCostUsd", Math.round(estimatedCost * 100.0) / 100.0);

        return stats;
    }

    // ===== INTERNAL TYPES =====

    private static class ThreatAnalysis {
        String threatId;
        AiDecision.Verdict verdict;
        double confidence;
        String reasoning;
    }
}
