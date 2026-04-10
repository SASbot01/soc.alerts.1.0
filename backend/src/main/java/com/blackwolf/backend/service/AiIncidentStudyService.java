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

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class AiIncidentStudyService {

    private static final Logger log = LoggerFactory.getLogger(AiIncidentStudyService.class);
    private static final String CLAUDE_API_URL = "https://api.anthropic.com/v1/messages";

    // Blacklist patterns that indicate a degenerate/corrupted AI response loop
    private static final List<String> DEGENERATE_PATTERNS = List.of(
            "CONFIRMACIÓN MATEMÁTICA",
            "CRISIS ORGANIZACIONAL",
            "DESTRUCCIÓN DEL MARCO ANALÍTICO",
            "CERTEZA MATEMÁTICA",
            "COLAPSO SISTÉMICO",
            "FALLO CATASTRÓFICO",
            "DESTRUCCIÓN PERPETUA",
            "CRISIS PERPETUA"
    );

    // Max consecutive failed quality checks before pausing studies for this company
    private static final int CIRCUIT_BREAKER_THRESHOLD = 3;
    private final Map<String, Integer> companyFailureCount = new java.util.concurrent.ConcurrentHashMap<>();

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final RestTemplate restTemplate = new RestTemplate();

    @Autowired private AiIncidentStudyRepository studyRepository;
    @Autowired private IncidentRepository incidentRepository;
    @Autowired private ThreatEventRepository threatEventRepository;
    @Autowired private ThreatEnrichmentRepository enrichmentRepository;
    @Autowired private IncidentTimelineRepository timelineRepository;
    @Autowired private AiDecisionRepository decisionRepository;
    @Autowired private CompanyRepository companyRepository;
    @Autowired private SseService sseService;

    @Value("${ai.claude.api-key:}")
    private String apiKey;

    @Value("${ai.claude.model:claude-sonnet-4-20250514}")
    private String model;

    @Value("${ai.agent.evolution.enabled:true}")
    private boolean evolutionEnabled;

    @Value("${ai.agent.evolution.max-studies-per-cycle:5}")
    private int maxStudiesPerCycle;

    @Value("${ai.agent.evolution.study-lookback-days:7}")
    private int studyLookbackDays;

    @Value("${ai.agent.evolution.study-max-tokens:6144}")
    private int studyMaxTokens;

    // ===== SCHEDULED JOB =====

    @Scheduled(fixedDelayString = "${ai.agent.evolution.study-interval-ms:1800000}")
    public void processUnstudiedIncidents() {
        if (!evolutionEnabled || apiKey == null || apiKey.isBlank()) {
            return;
        }

        try {
            List<Company> companies = companyRepository.findAll();
            for (Company company : companies) {
                try {
                    studyCompanyIncidents(company.getId());
                } catch (Exception e) {
                    log.error("AI Evolution: Failed to study incidents for company {}: {}",
                            company.getId(), e.getMessage());
                }
            }
        } catch (Exception e) {
            log.error("AI Evolution: Scheduled study job failed: {}", e.getMessage());
        }
    }

    private void studyCompanyIncidents(String companyId) {
        // Circuit breaker: skip if too many consecutive degenerate responses
        int failures = companyFailureCount.getOrDefault(companyId, 0);
        if (failures >= CIRCUIT_BREAKER_THRESHOLD) {
            log.warn("AI Evolution: Circuit breaker OPEN for company {} ({} consecutive degenerate responses). " +
                    "Skipping studies. Will reset on next successful study or after restart.",
                    companyId, failures);
            return;
        }

        LocalDateTime since = LocalDateTime.now().minusDays(studyLookbackDays);
        List<String> unstudied = studyRepository.findUnstudiedIncidentIds(companyId, since);

        if (unstudied.isEmpty()) return;

        int toStudy = Math.min(unstudied.size(), maxStudiesPerCycle);
        log.info("AI Evolution: Found {} unstudied incidents for company {}, studying {}",
                unstudied.size(), companyId, toStudy);

        for (int i = 0; i < toStudy; i++) {
            try {
                studyIncident(companyId, unstudied.get(i));
            } catch (Exception e) {
                log.error("AI Evolution: Failed to study incident {}: {}", unstudied.get(i), e.getMessage());
            }
        }
    }

    // ===== CORE STUDY METHOD =====

    public AiIncidentStudy studyIncident(String companyId, String incidentId) {
        // Check for duplicate study
        Optional<AiIncidentStudy> existing = studyRepository.findByIncidentIdAndStudyType(
                incidentId, AiIncidentStudy.StudyType.DEEP_ANALYSIS);
        if (existing.isPresent()) {
            log.debug("AI Evolution: Incident {} already studied", incidentId);
            return existing.get();
        }

        Incident incident = incidentRepository.findById(incidentId).orElse(null);
        if (incident == null) {
            log.warn("AI Evolution: Incident {} not found", incidentId);
            return null;
        }

        // Create study record
        AiIncidentStudy study = new AiIncidentStudy();
        study.setCompanyId(companyId);
        study.setIncidentId(incidentId);
        study.setStudyType(AiIncidentStudy.StudyType.DEEP_ANALYSIS);
        study.setStatus(AiIncidentStudy.StudyStatus.IN_PROGRESS);
        study.setThreatEventId(incident.getSourceThreatId());
        studyRepository.save(study);

        long startTime = System.currentTimeMillis();

        try {
            // 1. Load full context
            String context = buildIncidentContext(incident);

            // 2. Find similar past incidents and their studies
            String pastStudies = buildPastStudiesContext(companyId, incident);

            // 3. Build prompts
            String systemPrompt = buildStudySystemPrompt();
            String userPrompt = buildStudyUserPrompt(context, pastStudies);

            // 4. Call Claude API
            Map<String, Object> apiResponse = callClaudeApi(systemPrompt, userPrompt, studyMaxTokens);
            String content = extractContent(apiResponse);
            int tokensUsed = extractTokensUsed(apiResponse);

            // 5. Parse response
            parseAndPopulateStudy(study, content);

            // 5.5. Quality gate: reject degenerate/corrupted responses
            if (isDegenerateResponse(study)) {
                log.warn("AI Evolution: DEGENERATE response detected for incident {}. Discarding study.", incidentId);
                study.setStatus(AiIncidentStudy.StudyStatus.FAILED);
                study.setErrorMessage("Quality gate rejected: degenerate/self-referential response detected");
                study.setStudyDurationMs(System.currentTimeMillis() - startTime);
                studyRepository.save(study);
                companyFailureCount.merge(companyId, 1, Integer::sum);
                sseService.emitAiAgentLog(companyId, "WARN", "QUALITY_GATE",
                        "Study rejected for incident " + incidentId.substring(0, 8) +
                        " - degenerate AI response detected. Circuit breaker: " +
                        companyFailureCount.getOrDefault(companyId, 0) + "/" + CIRCUIT_BREAKER_THRESHOLD);
                return study;
            }

            // Quality passed - reset circuit breaker
            companyFailureCount.put(companyId, 0);

            // 6. Complete
            study.setStatus(AiIncidentStudy.StudyStatus.COMPLETED);
            study.setTokensUsed(tokensUsed);
            study.setStudyDurationMs(System.currentTimeMillis() - startTime);
            study.setCompletedAt(LocalDateTime.now());
            studyRepository.save(study);

            // 7. Add timeline entry to incident
            addTimelineEntry(incidentId, study);

            sseService.emitAiAgentLog(companyId, "INFO", "DEEP_STUDY",
                    "Deep study completed for incident " + incidentId.substring(0, 8) +
                    " | Sophistication: " + study.getAttackSophistication() + "/10" +
                    " | " + tokensUsed + " tokens");

            log.info("AI Evolution: Study completed for incident {} ({}ms, {} tokens)",
                    incidentId, study.getStudyDurationMs(), tokensUsed);

            return study;

        } catch (Exception e) {
            study.setStatus(AiIncidentStudy.StudyStatus.FAILED);
            study.setErrorMessage(e.getMessage());
            study.setStudyDurationMs(System.currentTimeMillis() - startTime);
            studyRepository.save(study);
            log.error("AI Evolution: Study failed for incident {}: {}", incidentId, e.getMessage());
            return study;
        }
    }

    // ===== CONTEXT BUILDERS =====

    private String buildIncidentContext(Incident incident) {
        StringBuilder ctx = new StringBuilder();
        ctx.append("=== INCIDENT ===\n");
        ctx.append("ID: ").append(incident.getId()).append("\n");
        ctx.append("Title: ").append(incident.getTitle()).append("\n");
        ctx.append("Severity: ").append(incident.getSeverity()).append("\n");
        ctx.append("Status: ").append(incident.getStatus()).append("\n");
        ctx.append("Description: ").append(incident.getDescription()).append("\n");
        ctx.append("Created: ").append(incident.getCreatedAt()).append("\n");
        if (incident.getResolvedAt() != null) {
            ctx.append("Resolved: ").append(incident.getResolvedAt()).append("\n");
        }

        // Source threat
        if (incident.getSourceThreatId() != null) {
            threatEventRepository.findById(incident.getSourceThreatId()).ifPresent(threat -> {
                ctx.append("\n=== SOURCE THREAT ===\n");
                ctx.append("Type: ").append(threat.getThreatType()).append("\n");
                ctx.append("Severity: ").append(threat.getSeverity()).append("/10\n");
                ctx.append("Source IP: ").append(threat.getSrcIp()).append("\n");
                ctx.append("Target IP: ").append(threat.getDstIp()).append("\n");
                ctx.append("Port: ").append(threat.getDstPort()).append("\n");
                ctx.append("Description: ").append(threat.getDescription()).append("\n");

                // IP enrichment
                if (threat.getSrcIp() != null) {
                    enrichmentRepository.findById(threat.getSrcIp()).ifPresent(e -> {
                        ctx.append("\n=== IP INTELLIGENCE ===\n");
                        ctx.append("Country: ").append(e.getCountryCode()).append("\n");
                        ctx.append("ISP: ").append(e.getIsp()).append("\n");
                        ctx.append("Abuse Score: ").append(e.getAbuseConfidenceScore()).append("\n");
                        ctx.append("Tor: ").append(e.isTor()).append(" | VPN: ").append(e.isVpn()).append("\n");
                        ctx.append("Reports: ").append(e.getTotalReports()).append("\n");
                    });
                }
            });
        }

        // Timeline
        List<IncidentTimeline> timeline = timelineRepository.findByIncidentIdOrderByCreatedAtDesc(incident.getId());
        if (!timeline.isEmpty()) {
            ctx.append("\n=== TIMELINE ===\n");
            for (IncidentTimeline entry : timeline) {
                ctx.append("  [").append(entry.getCreatedAt()).append("] ")
                   .append(entry.getAction()).append(": ")
                   .append(entry.getDescription()).append("\n");
            }
        }

        // AI decisions for this threat
        if (incident.getSourceThreatId() != null) {
            List<AiDecision> decisions = decisionRepository.findByThreatEventId(incident.getSourceThreatId());
            if (!decisions.isEmpty()) {
                ctx.append("\n=== AI DECISIONS ===\n");
                for (AiDecision d : decisions) {
                    ctx.append("  Verdict: ").append(d.getVerdict())
                       .append(" | Confidence: ").append(d.getConfidence())
                       .append(" | Reasoning: ").append(d.getReasoning()).append("\n");
                }
            }
        }

        return ctx.toString();
    }

    private String buildPastStudiesContext(String companyId, Incident incident) {
        // Find similar past studies: same threat type or similar severity
        List<AiIncidentStudy> recentStudies = studyRepository.findRecentCompleted(
                companyId, LocalDateTime.now().minusDays(30));

        if (recentStudies.isEmpty()) return "";

        // Filter: exclude current incident, exclude degenerate/corrupted studies, limit diversity
        List<AiIncidentStudy> similar = recentStudies.stream()
                .filter(s -> !s.getIncidentId().equals(incident.getId()))
                .filter(s -> !isDegenerateResponse(s))  // CRITICAL: exclude corrupted studies
                .limit(5)
                .collect(Collectors.toList());

        if (similar.isEmpty()) return "";

        // Additional diversity check: skip if all studies have identical root causes
        long uniqueRootCauses = similar.stream()
                .map(AiIncidentStudy::getRootCause)
                .filter(Objects::nonNull)
                .distinct()
                .count();
        if (similar.size() > 2 && uniqueRootCauses <= 1) {
            log.warn("AI Evolution: All past studies have identical root causes - skipping past context to break potential loop");
            return "";
        }

        StringBuilder ctx = new StringBuilder();
        ctx.append("\n=== ESTUDIOS SIMILARES ANTERIORES (memoria del agente) ===\n");
        for (AiIncidentStudy s : similar) {
            ctx.append("--- Estudio ").append(s.getId().substring(0, 8)).append(" ---\n");
            if (s.getRootCause() != null) ctx.append("Root Cause: ").append(s.getRootCause()).append("\n");
            if (s.getAttackSophistication() != null) ctx.append("Sophistication: ").append(s.getAttackSophistication()).append("/10\n");
            if (s.getLessonsLearned() != null) ctx.append("Lessons: ").append(s.getLessonsLearned()).append("\n");
            if (s.getDefenseRecommendations() != null) ctx.append("Defenses: ").append(s.getDefenseRecommendations()).append("\n");
            ctx.append("\n");
        }
        return ctx.toString();
    }

    // ===== PROMPTS =====

    private String buildStudySystemPrompt() {
        return """
                Eres un analista de ciberseguridad experto que realiza estudios profundos de incidentes de seguridad.
                Tu objetivo es aprender de cada incidente para mejorar las defensas futuras.

                Analiza el incidente proporcionado y genera un estudio profundo con los siguientes campos:

                1. root_cause: Causa raíz del incidente (qué lo originó)
                2. attack_vector_analysis: Análisis detallado del vector de ataque utilizado
                3. vulnerability_exploited: Qué vulnerabilidad fue explotada o intentaron explotar
                4. attack_sophistication: Nivel de sofisticación del ataque (1-10)
                5. defense_recommendations: Lista de recomendaciones defensivas específicas y accionables
                6. mitre_techniques: Lista de técnicas MITRE ATT&CK identificadas (ej: T1190, T1059)
                7. new_patterns_discovered: Patrones nuevos que descubriste en este incidente
                8. improvement_insights: Ideas para mejorar la detección y respuesta
                9. lessons_learned: Lecciones aprendidas de este incidente

                REGLAS CRÍTICAS:
                - Analiza SOLO los datos técnicos del incidente proporcionado. No generes meta-análisis sobre el propio sistema de análisis.
                - Si el incidente fue generado automáticamente por un playbook o respuesta automatizada, analiza el evento ORIGINAL que lo disparó, no la respuesta automática en sí.
                - Si un incidente parece ser tráfico legítimo o actividad administrativa normal (actualizaciones, deploys, accesos SSH autorizados), indica claramente que la causa raíz es un falso positivo y recomienda agregar la IP/actividad a una whitelist.
                - NUNCA generes textos auto-referenciales sobre "crisis del marco analítico", "destrucción del sistema", "colapso organizacional" o similar. Eso NO es análisis de seguridad.
                - Cada estudio DEBE ser único y específico al incidente analizado. No copies conclusiones genéricas.
                - Las recomendaciones defensivas deben ser ACCIONABLES (ej: "Agregar IP X.X.X.X a whitelist", "Crear regla de exclusión para puerto Y").

                Si se proporcionan estudios anteriores similares, COMPÁRALOS con el incidente actual.
                Identifica si hay patrones recurrentes, si las defensas anteriores funcionaron,
                y si hay evolución en las tácticas del atacante.

                Responde EXCLUSIVAMENTE en formato JSON válido:
                ```json
                {
                  "root_cause": "string",
                  "attack_vector_analysis": "string",
                  "vulnerability_exploited": "string",
                  "attack_sophistication": 7,
                  "defense_recommendations": ["rec1", "rec2"],
                  "mitre_techniques": ["T1190", "T1059"],
                  "new_patterns_discovered": ["pattern1", "pattern2"],
                  "improvement_insights": "string",
                  "lessons_learned": "string"
                }
                ```
                """;
    }

    private String buildStudyUserPrompt(String incidentContext, String pastStudies) {
        StringBuilder prompt = new StringBuilder();
        prompt.append("ESTUDIO PROFUNDO DE INCIDENTE\n\n");
        prompt.append(incidentContext);
        if (pastStudies != null && !pastStudies.isBlank()) {
            prompt.append("\n").append(pastStudies);
        }
        prompt.append("\nRealiza el estudio profundo y responde con el JSON estructurado.");
        return prompt.toString();
    }

    // ===== RESPONSE PARSING =====

    private void parseAndPopulateStudy(AiIncidentStudy study, String content) {
        try {
            String json = cleanJsonResponse(content);
            JsonNode root = objectMapper.readTree(json);

            study.setRootCause(getTextOrNull(root, "root_cause"));
            study.setAttackVectorAnalysis(getTextOrNull(root, "attack_vector_analysis"));
            study.setVulnerabilityExploited(getTextOrNull(root, "vulnerability_exploited"));

            if (root.has("attack_sophistication")) {
                study.setAttackSophistication(root.get("attack_sophistication").asInt());
            }

            study.setDefenseRecommendations(getJsonArrayOrNull(root, "defense_recommendations"));
            study.setMitreTechniquesIdentified(getJsonArrayOrNull(root, "mitre_techniques"));
            study.setNewPatternsDiscovered(getJsonArrayOrNull(root, "new_patterns_discovered"));
            study.setImprovementInsights(getTextOrNull(root, "improvement_insights"));
            study.setLessonsLearned(getTextOrNull(root, "lessons_learned"));

        } catch (Exception e) {
            log.warn("AI Evolution: Failed to parse study response: {}", e.getMessage());
            study.setRootCause("Parse error. Raw: " + (content != null ? content.substring(0, Math.min(content.length(), 500)) : "null"));
        }
    }

    private String getTextOrNull(JsonNode root, String field) {
        return root.has(field) && !root.get(field).isNull() ? root.get(field).asText() : null;
    }

    private String getJsonArrayOrNull(JsonNode root, String field) {
        if (root.has(field) && root.get(field).isArray()) {
            try {
                return objectMapper.writeValueAsString(root.get(field));
            } catch (Exception e) {
                return null;
            }
        }
        return null;
    }

    private String cleanJsonResponse(String content) {
        if (content == null) return "{}";
        String cleaned = content.trim();
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

    // ===== TIMELINE =====

    private void addTimelineEntry(String incidentId, AiIncidentStudy study) {
        try {
            IncidentTimeline entry = new IncidentTimeline();
            entry.setId(UUID.randomUUID().toString());
            entry.setIncidentId(incidentId);
            entry.setAction("AI_DEEP_STUDY");
            entry.setDescription("AI Deep Study completed. Sophistication: " +
                    study.getAttackSophistication() + "/10. Root cause: " +
                    (study.getRootCause() != null ? study.getRootCause().substring(0, Math.min(study.getRootCause().length(), 150)) : "N/A"));
            entry.setPerformedBy("AI Agent");
            entry.setCreatedAt(LocalDateTime.now());
            timelineRepository.save(entry);
        } catch (Exception e) {
            log.error("AI Evolution: Failed to add timeline entry: {}", e.getMessage());
        }
    }

    // ===== QUALITY VALIDATION =====

    /**
     * Detects degenerate/corrupted AI responses that indicate a feedback loop.
     * Checks all text fields for known degenerate patterns.
     */
    private boolean isDegenerateResponse(AiIncidentStudy study) {
        String combined = String.join(" ",
                study.getRootCause() != null ? study.getRootCause() : "",
                study.getDefenseRecommendations() != null ? study.getDefenseRecommendations() : "",
                study.getLessonsLearned() != null ? study.getLessonsLearned() : "",
                study.getImprovementInsights() != null ? study.getImprovementInsights() : "",
                study.getAttackVectorAnalysis() != null ? study.getAttackVectorAnalysis() : ""
        ).toUpperCase();

        for (String pattern : DEGENERATE_PATTERNS) {
            if (combined.contains(pattern.toUpperCase())) {
                return true;
            }
        }

        // Also flag if all recommendations are identical (single repeated string)
        if (study.getDefenseRecommendations() != null) {
            try {
                var arr = objectMapper.readTree(study.getDefenseRecommendations());
                if (arr.isArray() && arr.size() > 2) {
                    Set<String> unique = new HashSet<>();
                    for (var node : arr) unique.add(node.asText());
                    if (unique.size() == 1) return true; // all identical recommendations
                }
            } catch (Exception ignored) {}
        }

        return false;
    }

    /**
     * Purge corrupted/degenerate studies from the database.
     * Returns the count of purged studies.
     */
    public int purgeCorruptedStudies(String companyId) {
        List<AiIncidentStudy> all = studyRepository.findByCompanyIdOrderByCreatedAtDesc(companyId);
        int purged = 0;
        for (AiIncidentStudy study : all) {
            if (isDegenerateResponse(study)) {
                study.setStatus(AiIncidentStudy.StudyStatus.FAILED);
                study.setErrorMessage("Purged: degenerate feedback loop response detected");
                studyRepository.save(study);
                purged++;
            }
        }
        // Reset circuit breaker after purge
        companyFailureCount.put(companyId, 0);
        log.info("AI Evolution: Purged {} corrupted studies for company {}", purged, companyId);
        return purged;
    }

    /**
     * Reset circuit breaker for a company (e.g., after fixing the issue).
     */
    public void resetCircuitBreaker(String companyId) {
        companyFailureCount.put(companyId, 0);
        log.info("AI Evolution: Circuit breaker reset for company {}", companyId);
    }

    // ===== CLAUDE API =====

    @SuppressWarnings("unchecked")
    private Map<String, Object> callClaudeApi(String systemPrompt, String userMessage, int maxTokens) {
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

    // ===== PUBLIC API =====

    public List<AiIncidentStudy> getStudies(String companyId, String type) {
        if (type != null && !type.isBlank()) {
            try {
                AiIncidentStudy.StudyType studyType = AiIncidentStudy.StudyType.valueOf(type.toUpperCase());
                return studyRepository.findByCompanyIdAndStudyTypeOrderByCreatedAtDesc(companyId, studyType);
            } catch (IllegalArgumentException e) {
                // ignore invalid type, return all
            }
        }
        return studyRepository.findByCompanyIdOrderByCreatedAtDesc(companyId);
    }

    public Optional<AiIncidentStudy> getStudy(String id) {
        return studyRepository.findById(id);
    }
}
