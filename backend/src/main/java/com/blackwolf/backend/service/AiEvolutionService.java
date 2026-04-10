package com.blackwolf.backend.service;

import com.blackwolf.backend.model.*;
import com.blackwolf.backend.repository.*;
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
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class AiEvolutionService {

    private static final Logger log = LoggerFactory.getLogger(AiEvolutionService.class);
    private static final String CLAUDE_API_URL = "https://api.anthropic.com/v1/messages";

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final RestTemplate restTemplate = new RestTemplate();

    @Autowired private AiEvolutionSnapshotRepository snapshotRepository;
    @Autowired private AiIncidentStudyRepository studyRepository;
    @Autowired private AiDecisionRepository decisionRepository;
    @Autowired private AiNoisePatternRepository noisePatternRepository;
    @Autowired private CompanyRepository companyRepository;

    @Value("${ai.claude.api-key:}")
    private String apiKey;

    @Value("${ai.claude.model:claude-sonnet-4-20250514}")
    private String model;

    @Value("${ai.agent.evolution.enabled:true}")
    private boolean evolutionEnabled;

    @Value("${ai.agent.evolution.summary-max-tokens:4096}")
    private int summaryMaxTokens;

    // ===== SCHEDULED JOBS =====

    @Scheduled(cron = "${ai.agent.evolution.daily-cron:0 0 0 * * *}")
    public void generateDailySnapshots() {
        if (!evolutionEnabled) return;
        generateSnapshotsForAllCompanies(AiEvolutionSnapshot.PeriodType.DAILY);
    }

    @Scheduled(cron = "${ai.agent.evolution.weekly-cron:0 0 1 * * MON}")
    public void generateWeeklySnapshots() {
        if (!evolutionEnabled) return;
        generateSnapshotsForAllCompanies(AiEvolutionSnapshot.PeriodType.WEEKLY);
    }

    private void generateSnapshotsForAllCompanies(AiEvolutionSnapshot.PeriodType periodType) {
        try {
            List<Company> companies = companyRepository.findAll();
            for (Company company : companies) {
                try {
                    generateEvolutionSnapshot(company.getId(), periodType);
                } catch (Exception e) {
                    log.error("AI Evolution: Snapshot generation failed for company {}: {}",
                            company.getId(), e.getMessage());
                }
            }
        } catch (Exception e) {
            log.error("AI Evolution: Scheduled snapshot job failed: {}", e.getMessage());
        }
    }

    // ===== SNAPSHOT GENERATION =====

    public AiEvolutionSnapshot generateEvolutionSnapshot(String companyId, AiEvolutionSnapshot.PeriodType periodType) {
        int days = switch (periodType) {
            case DAILY -> 1;
            case WEEKLY -> 7;
            case MONTHLY -> 30;
        };

        LocalDateTime since = LocalDateTime.now().minusDays(days);
        LocalDate today = LocalDate.now();

        // Get previous snapshot
        Optional<AiEvolutionSnapshot> previousOpt = snapshotRepository
                .findFirstByCompanyIdAndPeriodTypeOrderBySnapshotDateDesc(companyId, periodType);

        AiEvolutionSnapshot snapshot = new AiEvolutionSnapshot();
        snapshot.setCompanyId(companyId);
        snapshot.setSnapshotDate(today);
        snapshot.setPeriodType(periodType);
        previousOpt.ifPresent(prev -> snapshot.setPreviousSnapshotId(prev.getId()));

        // Calculate metrics from studies (filter out corrupted ones)
        List<AiIncidentStudy> periodStudies = studyRepository.findRecentCompleted(companyId, since)
                .stream().filter(s -> !isCorruptedStudy(s)).collect(Collectors.toList());
        snapshot.setTotalIncidentsStudied(periodStudies.size());

        // Count patterns discovered
        long patternsCount = periodStudies.stream()
                .filter(s -> s.getNewPatternsDiscovered() != null && !"[]".equals(s.getNewPatternsDiscovered()))
                .count();
        snapshot.setNewPatternsCount((int) patternsCount);

        // Count defense improvements
        long defenseCount = periodStudies.stream()
                .filter(s -> s.getDefenseRecommendations() != null && !"[]".equals(s.getDefenseRecommendations()))
                .count();
        snapshot.setDefenseImprovementsCount((int) defenseCount);

        // Calculate accuracy from AI decisions
        List<AiDecision> periodDecisions = decisionRepository.findRecentByCompany(companyId, since);
        if (!periodDecisions.isEmpty()) {
            // Accuracy: ratio of decisions with confidence > 0.7
            long highConfidence = periodDecisions.stream()
                    .filter(d -> d.getConfidence() != null && d.getConfidence().doubleValue() > 0.7)
                    .count();
            snapshot.setAccuracyScore((double) highConfidence / periodDecisions.size() * 100);

            // Mean confidence
            double meanConf = periodDecisions.stream()
                    .filter(d -> d.getConfidence() != null)
                    .mapToDouble(d -> d.getConfidence().doubleValue())
                    .average()
                    .orElse(0.0);
            snapshot.setMeanConfidenceScore(meanConf * 100);

            // False positive reduction: compare noise ratio with previous snapshot
            long noiseCount = periodDecisions.stream()
                    .filter(d -> d.getVerdict() == AiDecision.Verdict.NOISE || d.getVerdict() == AiDecision.Verdict.FALSE_POSITIVE)
                    .count();
            double fpRatio = (double) noiseCount / periodDecisions.size() * 100;

            if (previousOpt.isPresent() && previousOpt.get().getFalsePositiveReductionPct() != null) {
                snapshot.setFalsePositiveReductionPct(
                        previousOpt.get().getFalsePositiveReductionPct() - fpRatio);
            } else {
                snapshot.setFalsePositiveReductionPct(fpRatio);
            }
        } else {
            snapshot.setAccuracyScore(0.0);
            snapshot.setMeanConfidenceScore(0.0);
            snapshot.setFalsePositiveReductionPct(0.0);
        }

        // Mean response time (from study durations)
        OptionalDouble meanDuration = periodStudies.stream()
                .filter(s -> s.getStudyDurationMs() != null)
                .mapToLong(AiIncidentStudy::getStudyDurationMs)
                .average();
        snapshot.setMeanResponseTimeMs(meanDuration.isPresent() ? (long) meanDuration.getAsDouble() : 0L);

        // Top attack types from studies
        snapshot.setTopAttackTypes(buildTopAttackTypes(periodStudies));
        snapshot.setTopDefensesProposed(buildTopDefenses(periodStudies));

        // Generate AI narrative summary
        if (apiKey != null && !apiKey.isBlank() && !periodStudies.isEmpty()) {
            try {
                String narrativeSummary = generateNarrativeSummary(snapshot, previousOpt.orElse(null), periodStudies);
                snapshot.setEvolutionSummary(narrativeSummary);
            } catch (Exception e) {
                log.warn("AI Evolution: Failed to generate narrative summary: {}", e.getMessage());
                snapshot.setEvolutionSummary("Summary generation failed: " + e.getMessage());
            }
        }

        snapshotRepository.save(snapshot);
        log.info("AI Evolution: {} snapshot generated for company {} ({} studies, accuracy: {}%)",
                periodType, companyId, periodStudies.size(),
                snapshot.getAccuracyScore() != null ? String.format("%.1f", snapshot.getAccuracyScore()) : "N/A");

        return snapshot;
    }

    // ===== NARRATIVE SUMMARY =====

    private String generateNarrativeSummary(AiEvolutionSnapshot snapshot,
                                             AiEvolutionSnapshot previousSnapshot,
                                             List<AiIncidentStudy> studies) {
        StringBuilder prompt = new StringBuilder();
        prompt.append("Genera un resumen narrativo de la evolución del agente de seguridad AI.\n\n");
        prompt.append("=== MÉTRICAS DEL PERIODO ===\n");
        prompt.append("Incidentes estudiados: ").append(snapshot.getTotalIncidentsStudied()).append("\n");
        prompt.append("Accuracy: ").append(String.format("%.1f", snapshot.getAccuracyScore())).append("%\n");
        prompt.append("Confidence promedio: ").append(String.format("%.1f", snapshot.getMeanConfidenceScore())).append("%\n");
        prompt.append("Nuevos patrones: ").append(snapshot.getNewPatternsCount()).append("\n");
        prompt.append("Mejoras defensivas: ").append(snapshot.getDefenseImprovementsCount()).append("\n");

        if (previousSnapshot != null) {
            prompt.append("\n=== SNAPSHOT ANTERIOR ===\n");
            prompt.append("Accuracy anterior: ").append(String.format("%.1f", previousSnapshot.getAccuracyScore())).append("%\n");
            prompt.append("Confidence anterior: ").append(String.format("%.1f", previousSnapshot.getMeanConfidenceScore())).append("%\n");
            prompt.append("Estudios anteriores: ").append(previousSnapshot.getTotalIncidentsStudied()).append("\n");
        }

        prompt.append("\n=== LECCIONES APRENDIDAS (últimos estudios) ===\n");
        for (AiIncidentStudy s : studies.stream()
                .filter(st -> st.getLessonsLearned() != null)
                .filter(st -> !isCorruptedStudy(st))  // Filter out corrupted studies
                .limit(10)
                .collect(Collectors.toList())) {
            prompt.append("- ").append(s.getLessonsLearned()).append("\n");
        }

        prompt.append("\nGenera un resumen de 3-5 párrafos sobre: evolución del agente, áreas de mejora, ");
        prompt.append("áreas que necesitan atención, y recomendaciones para el equipo SOC. ");
        prompt.append("Responde en formato JSON: ");
        prompt.append("{\"evolution_summary\": \"...\", \"areas_of_improvement\": \"...\", \"areas_needing_attention\": \"...\"}");

        String systemPrompt = "Eres un analista de ciberseguridad que evalúa la evolución y aprendizaje de un agente AI de seguridad. " +
                "Genera un análisis objetivo basado SOLO en las métricas y lecciones proporcionadas. " +
                "NO generes textos auto-referenciales sobre 'crisis del marco analítico', 'destrucción del sistema', " +
                "'colapso organizacional' o meta-análisis catastrofistas. Mantén un tono profesional y constructivo. " +
                "Si las métricas son bajas, sugiere mejoras concretas en lugar de diagnosticar fallos existenciales. " +
                "Responde en JSON.";

        try {
            Map<String, Object> apiResponse = callClaudeApi(systemPrompt, prompt.toString(), summaryMaxTokens);
            String content = extractContent(apiResponse);
            int tokensUsed = extractTokensUsed(apiResponse);
            snapshot.setTokensUsed(tokensUsed);

            String json = cleanJsonResponse(content);
            var root = objectMapper.readTree(json);

            if (root.has("evolution_summary")) {
                snapshot.setAreasOfImprovement(root.has("areas_of_improvement") ? root.get("areas_of_improvement").asText() : null);
                snapshot.setAreasNeedingAttention(root.has("areas_needing_attention") ? root.get("areas_needing_attention").asText() : null);
                return root.get("evolution_summary").asText();
            }
            return content;
        } catch (Exception e) {
            log.warn("AI Evolution: Narrative generation failed: {}", e.getMessage());
            return null;
        }
    }

    // ===== AGGREGATION HELPERS =====

    private String buildTopAttackTypes(List<AiIncidentStudy> studies) {
        try {
            Map<String, Long> attackCounts = new LinkedHashMap<>();
            for (AiIncidentStudy s : studies) {
                if (s.getAttackVectorAnalysis() != null) {
                    String key = s.getAttackVectorAnalysis().length() > 50
                            ? s.getAttackVectorAnalysis().substring(0, 50)
                            : s.getAttackVectorAnalysis();
                    attackCounts.merge(key, 1L, Long::sum);
                }
            }
            List<Map<String, Object>> top = attackCounts.entrySet().stream()
                    .sorted(Map.Entry.<String, Long>comparingByValue().reversed())
                    .limit(10)
                    .map(e -> {
                        Map<String, Object> m = new LinkedHashMap<>();
                        m.put("type", e.getKey());
                        m.put("count", e.getValue());
                        return m;
                    })
                    .collect(Collectors.toList());
            return objectMapper.writeValueAsString(top);
        } catch (Exception e) {
            return "[]";
        }
    }

    private String buildTopDefenses(List<AiIncidentStudy> studies) {
        try {
            List<String> allDefenses = new ArrayList<>();
            for (AiIncidentStudy s : studies) {
                if (s.getDefenseRecommendations() != null) {
                    try {
                        var arr = objectMapper.readTree(s.getDefenseRecommendations());
                        if (arr.isArray()) {
                            for (var node : arr) {
                                allDefenses.add(node.asText());
                            }
                        }
                    } catch (Exception ignored) {}
                }
            }

            Map<String, Long> defenseCounts = allDefenses.stream()
                    .collect(Collectors.groupingBy(d -> d, Collectors.counting()));

            List<Map<String, Object>> top = defenseCounts.entrySet().stream()
                    .sorted(Map.Entry.<String, Long>comparingByValue().reversed())
                    .limit(10)
                    .map(e -> {
                        Map<String, Object> m = new LinkedHashMap<>();
                        m.put("defense", e.getKey());
                        m.put("count", e.getValue());
                        return m;
                    })
                    .collect(Collectors.toList());
            return objectMapper.writeValueAsString(top);
        } catch (Exception e) {
            return "[]";
        }
    }

    // ===== PUBLIC API (for controller) =====

    public Map<String, Object> getEvolutionTimeline(String companyId, int days) {
        LocalDate from = LocalDate.now().minusDays(days);
        LocalDate to = LocalDate.now();

        List<AiEvolutionSnapshot> snapshots = snapshotRepository
                .findByCompanyIdAndSnapshotDateBetweenOrderBySnapshotDateAsc(companyId, from, to);

        List<String> dates = new ArrayList<>();
        List<Double> accuracy = new ArrayList<>();
        List<Double> confidence = new ArrayList<>();
        List<Integer> patterns = new ArrayList<>();
        List<Integer> studies = new ArrayList<>();

        for (AiEvolutionSnapshot s : snapshots) {
            dates.add(s.getSnapshotDate().toString());
            accuracy.add(s.getAccuracyScore() != null ? s.getAccuracyScore() : 0.0);
            confidence.add(s.getMeanConfidenceScore() != null ? s.getMeanConfidenceScore() : 0.0);
            patterns.add(s.getNewPatternsCount() != null ? s.getNewPatternsCount() : 0);
            studies.add(s.getTotalIncidentsStudied() != null ? s.getTotalIncidentsStudied() : 0);
        }

        Map<String, Object> timeline = new LinkedHashMap<>();
        timeline.put("dates", dates);
        timeline.put("accuracy", accuracy);
        timeline.put("confidence", confidence);
        timeline.put("patterns", patterns);
        timeline.put("studies", studies);
        return timeline;
    }

    public Map<String, Object> getDashboardStats(String companyId) {
        Map<String, Object> stats = new LinkedHashMap<>();

        long totalStudies = studyRepository.countByCompanyIdAndStatus(companyId, AiIncidentStudy.StudyStatus.COMPLETED);
        stats.put("totalStudies", totalStudies);

        long totalPatterns = studyRepository.countWithNewPatterns(companyId);
        stats.put("patternsDiscovered", totalPatterns);

        // Latest accuracy from most recent snapshot
        Optional<AiEvolutionSnapshot> latestSnapshot = snapshotRepository
                .findFirstByCompanyIdAndPeriodTypeOrderBySnapshotDateDesc(companyId, AiEvolutionSnapshot.PeriodType.DAILY);

        if (latestSnapshot.isPresent()) {
            AiEvolutionSnapshot latest = latestSnapshot.get();
            stats.put("accuracyScore", latest.getAccuracyScore() != null ? latest.getAccuracyScore() : 0.0);
            stats.put("defenseImprovements", latest.getDefenseImprovementsCount() != null ? latest.getDefenseImprovementsCount() : 0);
            stats.put("meanConfidence", latest.getMeanConfidenceScore() != null ? latest.getMeanConfidenceScore() : 0.0);
            stats.put("lastSnapshotDate", latest.getSnapshotDate().toString());
        } else {
            stats.put("accuracyScore", 0.0);
            stats.put("defenseImprovements", 0);
            stats.put("meanConfidence", 0.0);
            stats.put("lastSnapshotDate", null);
        }

        stats.put("evolutionEnabled", evolutionEnabled);
        return stats;
    }

    public List<AiEvolutionSnapshot> getSnapshots(String companyId) {
        return snapshotRepository.findByCompanyIdOrderBySnapshotDateDesc(companyId);
    }

    // ===== QUALITY VALIDATION =====

    private static final List<String> DEGENERATE_PATTERNS = List.of(
            "CONFIRMACIÓN MATEMÁTICA", "CRISIS ORGANIZACIONAL", "DESTRUCCIÓN DEL MARCO ANALÍTICO",
            "CERTEZA MATEMÁTICA", "COLAPSO SISTÉMICO", "FALLO CATASTRÓFICO",
            "DESTRUCCIÓN PERPETUA", "CRISIS PERPETUA"
    );

    /**
     * Checks if a study response is corrupted/degenerate.
     */
    private boolean isCorruptedStudy(AiIncidentStudy study) {
        String combined = String.join(" ",
                study.getRootCause() != null ? study.getRootCause() : "",
                study.getDefenseRecommendations() != null ? study.getDefenseRecommendations() : "",
                study.getLessonsLearned() != null ? study.getLessonsLearned() : "",
                study.getImprovementInsights() != null ? study.getImprovementInsights() : ""
        ).toUpperCase();

        for (String pattern : DEGENERATE_PATTERNS) {
            if (combined.contains(pattern.toUpperCase())) {
                return true;
            }
        }
        return false;
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
}
