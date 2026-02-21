package com.blackwolf.backend.service;

import com.blackwolf.backend.model.*;
import com.blackwolf.backend.repository.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class AiThreatAnalystService {

    private static final Logger log = LoggerFactory.getLogger(AiThreatAnalystService.class);
    private static final String CLAUDE_API_URL = "https://api.anthropic.com/v1/messages";
    private static final int SLACK_CHUNK_SIZE = 2800;

    @Autowired private AiAgentReportRepository reportRepository;
    @Autowired private ThreatEventRepository threatEventRepository;
    @Autowired private IncidentRepository incidentRepository;
    @Autowired private SensorRepository sensorRepository;
    @Autowired private BlockedIPRepository blockedIPRepository;
    @Autowired private ThreatEnrichmentRepository enrichmentRepository;
    @Autowired private ThreatMitreMappingRepository mitreMappingRepository;
    @Autowired private MitreTechniqueRepository mitreTechniqueRepository;
    @Autowired private PlaybookRepository playbookRepository;
    @Autowired private PlaybookExecutionRepository playbookExecutionRepository;
    @Autowired private VulnerabilityRepository vulnerabilityRepository;
    @Autowired private CompanyRepository companyRepository;

    @Value("${ai.claude.api-key:}")
    private String apiKey;

    @Value("${ai.claude.model:claude-sonnet-4-20250514}")
    private String model;

    @Value("${ai.agent.enabled:false}")
    private boolean agentEnabled;

    @Value("${ai.agent.max-tokens:8192}")
    private int agentMaxTokens;

    @Value("${ai.agent.slack-webhook:}")
    private String slackWebhook;

    @Value("${ai.agent.slack-enabled:false}")
    private boolean slackEnabled;

    @Value("${ai.agent.analysis-hours:24}")
    private int analysisHours;

    private final RestTemplate restTemplate = new RestTemplate();

    // ===== SCHEDULED EXECUTION =====

    @Scheduled(cron = "${ai.agent.cron:0 0 */6 * * *}")
    public void runScheduledAnalysis() {
        if (!agentEnabled) {
            log.debug("AI Agent is disabled, skipping scheduled analysis");
            return;
        }
        if (apiKey == null || apiKey.isBlank()) {
            log.warn("AI Agent: Claude API key not configured");
            return;
        }

        log.info("AI Agent: Starting scheduled analysis for all companies");
        List<Company> companies = companyRepository.findAll();
        for (Company company : companies) {
            if ("active".equalsIgnoreCase(company.getStatus())) {
                try {
                    analyzeCompany(company.getId());
                } catch (Exception e) {
                    log.error("AI Agent: Failed to analyze company {}: {}", company.getCompanyName(), e.getMessage());
                }
            }
        }
        log.info("AI Agent: Scheduled analysis complete");
    }

    // ===== MANUAL / PER-COMPANY ANALYSIS =====

    public List<AiAgentReport> analyzeCompany(String companyId) {
        log.info("AI Agent: Analyzing company {}", companyId);
        List<AiAgentReport> reports = new ArrayList<>();

        LocalDateTime periodEnd = LocalDateTime.now();
        LocalDateTime periodStart = periodEnd.minusHours(analysisHours);

        // Gather all SOC data
        Map<String, Object> socData = gatherData(companyId, periodStart, periodEnd);

        // Generate offensive report
        try {
            AiAgentReport offensive = generateReport(companyId, "OFFENSIVE", socData, periodStart, periodEnd);
            reports.add(offensive);
        } catch (Exception e) {
            log.error("AI Agent: Offensive report failed for {}: {}", companyId, e.getMessage());
        }

        // Generate defensive report
        try {
            AiAgentReport defensive = generateReport(companyId, "DEFENSIVE", socData, periodStart, periodEnd);
            reports.add(defensive);
        } catch (Exception e) {
            log.error("AI Agent: Defensive report failed for {}: {}", companyId, e.getMessage());
        }

        return reports;
    }

    // ===== DATA GATHERING =====

    private Map<String, Object> gatherData(String companyId, LocalDateTime periodStart, LocalDateTime periodEnd) {
        Map<String, Object> data = new LinkedHashMap<>();

        // Company info
        companyRepository.findById(companyId).ifPresent(c -> data.put("company", c));

        // Threats
        List<ThreatEvent> allThreats = threatEventRepository.findByCompanyId(companyId);
        List<ThreatEvent> recentThreats = allThreats.stream()
                .filter(t -> t.getTimestamp() != null && t.getTimestamp().isAfter(periodStart))
                .sorted((a, b) -> b.getTimestamp().compareTo(a.getTimestamp()))
                .collect(Collectors.toList());
        data.put("threats", recentThreats);
        data.put("totalThreats", allThreats.size());

        // Incidents
        List<Incident> incidents = incidentRepository.findByCompanyId(companyId);
        data.put("incidents", incidents);

        // Sensors
        List<Sensor> sensors = sensorRepository.findByCompanyId(companyId);
        data.put("sensors", sensors);

        // Blocked IPs
        List<BlockedIP> blockedIPs = blockedIPRepository.findByCompanyId(companyId);
        data.put("blockedIPs", blockedIPs);

        // Enrichments
        List<ThreatEnrichment> enrichments = enrichmentRepository.findAll().stream()
                .limit(100)
                .collect(Collectors.toList());
        data.put("enrichments", enrichments);

        // MITRE mappings
        List<MitreTechnique> mitreTechniques = mitreTechniqueRepository.findAll();
        data.put("mitreTechniques", mitreTechniques);

        // Playbooks
        List<Playbook> playbooks = playbookRepository.findByCompanyId(companyId);
        data.put("playbooks", playbooks);

        // Playbook executions
        List<PlaybookExecution> executions = playbookExecutionRepository.findByCompanyIdOrderByStartedAtDesc(companyId);
        data.put("playbookExecutions", executions);

        // Vulnerabilities
        List<Vulnerability> vulnerabilities = vulnerabilityRepository.findByCompanyId(companyId);
        data.put("vulnerabilities", vulnerabilities);

        return data;
    }

    // ===== REPORT GENERATION =====

    @SuppressWarnings("unchecked")
    private AiAgentReport generateReport(String companyId, String reportType,
                                          Map<String, Object> socData,
                                          LocalDateTime periodStart, LocalDateTime periodEnd) {
        // Create report record in progress
        AiAgentReport report = new AiAgentReport();
        report.setId(UUID.randomUUID().toString());
        report.setCompanyId(companyId);
        report.setReportType(reportType);
        report.setTitle(reportType + " Analysis - " + periodEnd.format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm")));
        report.setPeriodStart(periodStart);
        report.setPeriodEnd(periodEnd);
        report.setStatus("IN_PROGRESS");
        report.setSlackSent(false);
        report.setCreatedAt(LocalDateTime.now());

        List<ThreatEvent> threats = (List<ThreatEvent>) socData.get("threats");
        List<Incident> incidents = (List<Incident>) socData.get("incidents");
        report.setThreatsAnalyzed(threats != null ? threats.size() : 0);
        report.setIncidentsAnalyzed(incidents != null ? incidents.size() : 0);

        // Find previous report for learning mechanism
        Optional<AiAgentReport> previousReport = reportRepository
                .findFirstByCompanyIdAndReportTypeAndStatusOrderByCreatedAtDesc(companyId, reportType, "COMPLETED");
        previousReport.ifPresent(prev -> report.setPreviousReportId(prev.getId()));

        reportRepository.save(report);

        try {
            // Build context string from gathered data
            String contextData = buildContextString(socData);

            // Build prompt
            String systemPrompt = buildSystemPrompt(reportType, previousReport.orElse(null));
            String userPrompt = buildUserPrompt(reportType, contextData, periodStart, periodEnd);

            // Call Claude API
            Map<String, Object> apiResponse = callClaudeApi(systemPrompt, userPrompt);
            String content = extractContent(apiResponse);
            int tokensUsed = extractTokensUsed(apiResponse);

            // Extract summary (first 500 chars or first paragraph)
            String summary = extractSummary(content);

            // Update report
            report.setContent(content);
            report.setSummary(summary);
            report.setTokensUsed(tokensUsed);
            report.setStatus("COMPLETED");
            reportRepository.save(report);

            // Send to Slack
            if (slackEnabled && slackWebhook != null && !slackWebhook.isBlank()) {
                try {
                    sendSlackReport(report);
                    report.setSlackSent(true);
                    reportRepository.save(report);
                } catch (Exception e) {
                    log.error("AI Agent: Slack notification failed: {}", e.getMessage());
                }
            }

            log.info("AI Agent: {} report generated for company {} ({} tokens)",
                    reportType, companyId, tokensUsed);

        } catch (Exception e) {
            report.setStatus("FAILED");
            report.setErrorMessage(e.getMessage());
            reportRepository.save(report);
            log.error("AI Agent: Report generation failed: {}", e.getMessage());
            throw new RuntimeException("Report generation failed: " + e.getMessage(), e);
        }

        return report;
    }

    // ===== CONTEXT BUILDING =====

    @SuppressWarnings("unchecked")
    private String buildContextString(Map<String, Object> data) {
        StringBuilder ctx = new StringBuilder();

        // Company
        Object company = data.get("company");
        if (company instanceof Company c) {
            ctx.append("=== EMPRESA ===\n");
            ctx.append("Nombre: ").append(c.getCompanyName()).append("\n");
            ctx.append("Dominio: ").append(c.getDomain()).append("\n");
            ctx.append("Plan: ").append(c.getPlan()).append("\n\n");
        }

        // Threats
        List<ThreatEvent> threats = (List<ThreatEvent>) data.get("threats");
        int totalThreats = (int) data.getOrDefault("totalThreats", 0);
        ctx.append("=== AMENAZAS (período: ").append(threats != null ? threats.size() : 0)
                .append(", total histórico: ").append(totalThreats).append(") ===\n");
        if (threats != null) {
            // Group by type
            Map<String, Long> threatsByType = threats.stream()
                    .filter(t -> t.getThreatType() != null)
                    .collect(Collectors.groupingBy(ThreatEvent::getThreatType, Collectors.counting()));
            ctx.append("Por tipo: ").append(threatsByType).append("\n");

            // Group by severity
            Map<Integer, Long> threatsBySeverity = threats.stream()
                    .filter(t -> t.getSeverity() != null)
                    .collect(Collectors.groupingBy(ThreatEvent::getSeverity, Collectors.counting()));
            ctx.append("Por severidad: ").append(threatsBySeverity).append("\n");

            // Top source IPs
            Map<String, Long> topSources = threats.stream()
                    .filter(t -> t.getSrcIp() != null)
                    .collect(Collectors.groupingBy(ThreatEvent::getSrcIp, Collectors.counting()))
                    .entrySet().stream()
                    .sorted(Map.Entry.<String, Long>comparingByValue().reversed())
                    .limit(10)
                    .collect(Collectors.toMap(Map.Entry::getKey, Map.Entry::getValue,
                            (a, b) -> a, LinkedHashMap::new));
            ctx.append("Top IPs origen: ").append(topSources).append("\n");

            // Recent details (limit to 30)
            ctx.append("Detalle recientes:\n");
            threats.stream().limit(30).forEach(t ->
                    ctx.append("  - [Sev ").append(t.getSeverity()).append("] ")
                            .append(t.getThreatType())
                            .append(" | ").append(t.getSrcIp()).append(" → ").append(t.getDstIp())
                            .append(":").append(t.getDstPort())
                            .append(" | ").append(t.getStatus())
                            .append(" | ").append(t.getTimestamp())
                            .append(" | ").append(t.getDescription() != null ? t.getDescription() : "")
                            .append("\n"));
        }
        ctx.append("\n");

        // Incidents
        List<Incident> incidents = (List<Incident>) data.get("incidents");
        ctx.append("=== INCIDENTES (").append(incidents != null ? incidents.size() : 0).append(") ===\n");
        if (incidents != null) {
            long open = incidents.stream()
                    .filter(i -> !"RESOLVED".equalsIgnoreCase(i.getStatus()) && !"CLOSED".equalsIgnoreCase(i.getStatus()))
                    .count();
            ctx.append("Abiertos: ").append(open).append("\n");
            for (Incident i : incidents) {
                ctx.append("  - [").append(i.getSeverity()).append("] ").append(i.getTitle())
                        .append(" | Estado: ").append(i.getStatus())
                        .append(" | Asignado: ").append(i.getAssignedTo() != null ? i.getAssignedTo() : "sin asignar")
                        .append(" | SLA: ").append(i.getSlaDeadline())
                        .append("\n");
            }
        }
        ctx.append("\n");

        // Sensors
        List<Sensor> sensors = (List<Sensor>) data.get("sensors");
        ctx.append("=== SENSORES (").append(sensors != null ? sensors.size() : 0).append(") ===\n");
        if (sensors != null) {
            for (Sensor s : sensors) {
                ctx.append("  - ").append(s.getName())
                        .append(" | Estado: ").append(s.getStatus())
                        .append(" | Último visto: ").append(s.getLastSeen())
                        .append(" | Amenazas detectadas: ").append(s.getThreatsDetected())
                        .append("\n");
            }
        }
        ctx.append("\n");

        // Blocked IPs
        List<BlockedIP> blocked = (List<BlockedIP>) data.get("blockedIPs");
        ctx.append("=== IPs BLOQUEADAS (").append(blocked != null ? blocked.size() : 0).append(") ===\n");
        if (blocked != null) {
            for (BlockedIP b : blocked) {
                ctx.append("  - ").append(b.getIp())
                        .append(" | Razón: ").append(b.getReason())
                        .append(" | Bloqueada: ").append(b.getBlockedAt())
                        .append("\n");
            }
        }
        ctx.append("\n");

        // Enrichments
        List<ThreatEnrichment> enrichments = (List<ThreatEnrichment>) data.get("enrichments");
        ctx.append("=== ENRIQUECIMIENTO IP (").append(enrichments != null ? enrichments.size() : 0).append(") ===\n");
        if (enrichments != null) {
            for (ThreatEnrichment e : enrichments) {
                ctx.append("  - IP: ").append(e.getIp())
                        .append(" | País: ").append(e.getCountryCode())
                        .append(" | ISP: ").append(e.getIsp())
                        .append(" | Abuse Score: ").append(e.getAbuseConfidenceScore())
                        .append(" | Tor: ").append(e.isTor())
                        .append(" | VPN: ").append(e.isVpn())
                        .append("\n");
            }
        }
        ctx.append("\n");

        // MITRE techniques
        List<MitreTechnique> mitre = (List<MitreTechnique>) data.get("mitreTechniques");
        ctx.append("=== MITRE ATT&CK (").append(mitre != null ? mitre.size() : 0).append(" técnicas mapeadas) ===\n");
        if (mitre != null) {
            for (MitreTechnique m : mitre) {
                ctx.append("  - ").append(m.getId()).append(": ").append(m.getName())
                        .append(" | Táctica: ").append(m.getTactic())
                        .append("\n");
            }
        }
        ctx.append("\n");

        // Playbooks
        List<Playbook> playbooks = (List<Playbook>) data.get("playbooks");
        ctx.append("=== PLAYBOOKS (").append(playbooks != null ? playbooks.size() : 0).append(") ===\n");
        if (playbooks != null) {
            for (Playbook p : playbooks) {
                ctx.append("  - ").append(p.getName())
                        .append(" | Trigger: ").append(p.getTriggerType())
                        .append(" | Activo: ").append(p.getIsActive())
                        .append(" | Categoría: ").append(p.getCategory())
                        .append("\n");
            }
        }
        ctx.append("\n");

        // Playbook executions
        List<PlaybookExecution> executions = (List<PlaybookExecution>) data.get("playbookExecutions");
        ctx.append("=== EJECUCIONES PLAYBOOK (").append(executions != null ? executions.size() : 0).append(") ===\n");
        if (executions != null) {
            executions.stream().limit(20).forEach(e ->
                    ctx.append("  - Playbook: ").append(e.getPlaybookId())
                            .append(" | Estado: ").append(e.getStatus())
                            .append(" | Inicio: ").append(e.getStartedAt())
                            .append(" | Fin: ").append(e.getCompletedAt())
                            .append("\n"));
        }
        ctx.append("\n");

        // Vulnerabilities
        List<Vulnerability> vulns = (List<Vulnerability>) data.get("vulnerabilities");
        ctx.append("=== VULNERABILIDADES (").append(vulns != null ? vulns.size() : 0).append(") ===\n");
        if (vulns != null) {
            for (Vulnerability v : vulns) {
                ctx.append("  - [").append(v.getRiskLevel()).append(" CVSS:").append(v.getCvssScore()).append("] ")
                        .append(v.getTitle())
                        .append(" | CVE: ").append(v.getCveId() != null ? v.getCveId() : "N/A")
                        .append(" | Estado: ").append(v.getStatus())
                        .append(" | Activo: ").append(v.getAffectedAsset())
                        .append("\n");
            }
        }

        return ctx.toString();
    }

    // ===== PROMPT BUILDING =====

    private String buildSystemPrompt(String reportType, AiAgentReport previousReport) {
        String basePrompt;

        if ("OFFENSIVE".equals(reportType)) {
            basePrompt = """
                    Eres un analista Red Team senior del SOC de BlackWolf Security. Tu rol es analizar las amenazas \
                    detectadas desde la perspectiva ofensiva para entender cómo operan los atacantes y anticipar sus próximos movimientos.

                    Tu análisis DEBE incluir:
                    1. **Resumen Ejecutivo**: Panorama general de amenazas del período
                    2. **Análisis de TTPs**: Tácticas, Técnicas y Procedimientos observados (mapeo MITRE ATT&CK)
                    3. **Perfil de Atacantes**: Patrones de comportamiento, IPs recurrentes, infraestructura de ataque
                    4. **Cadenas de Ataque (Kill Chain)**: Reconstrucción de secuencias de ataque observadas
                    5. **Vectores de Ataque Efectivos**: Qué vectores fueron más exitosos y por qué
                    6. **Evolución de Amenazas**: Cómo están evolucionando las técnicas vs períodos anteriores
                    7. **Inteligencia Predictiva**: Qué tipos de ataques son probables a corto plazo
                    8. **Métricas de Riesgo**: Scoring cuantitativo del riesgo actual
                    9. **Indicadores de Compromiso (IoCs)**: Lista consolidada de IoCs relevantes

                    Responde en español. Sé técnico y detallado. Usa formato markdown.
                    """;
        } else {
            basePrompt = """
                    Eres un arquitecto Blue Team senior del SOC de BlackWolf Security. Tu rol es evaluar la postura \
                    defensiva y recomendar mejoras concretas para fortalecer las defensas.

                    Tu análisis DEBE incluir:
                    1. **Resumen Ejecutivo**: Estado actual de la postura defensiva
                    2. **Evaluación de Sensores**: Cobertura, eficacia, gaps de detección
                    3. **Eficacia de Playbooks**: Qué playbooks se ejecutaron, éxito/fallo, tiempos de respuesta
                    4. **Análisis de Respuesta a Incidentes**: Tiempos de detección, contención y resolución
                    5. **Gaps de Detección**: Amenazas que podrían no estar siendo detectadas
                    6. **Optimización de Reglas**: Recomendaciones para reducir falsos positivos/negativos
                    7. **Recomendaciones Priorizadas**: Top 10 acciones para mejorar defensas (por impacto/esfuerzo)
                    8. **Estado de Vulnerabilidades**: Análisis del programa de gestión de vulnerabilidades
                    9. **Plan 30/60/90 días**: Roadmap de mejoras defensivas priorizadas
                    10. **Métricas de Madurez**: Evaluación del nivel de madurez del SOC

                    Responde en español. Sé práctico y orientado a acción. Usa formato markdown.
                    """;
        }

        // Learning mechanism: inject previous report summary
        if (previousReport != null && previousReport.getSummary() != null) {
            basePrompt += "\n\n=== CONTEXTO DE APRENDIZAJE ===\n"
                    + "A continuación se incluye el resumen de tu análisis anterior ("
                    + previousReport.getCreatedAt().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm"))
                    + "). Compara las tendencias actuales con este análisis previo. "
                    + "Evalúa si las recomendaciones anteriores se implementaron y su efectividad. "
                    + "Identifica tendencias emergentes o cambios significativos.\n\n"
                    + "RESUMEN ANTERIOR:\n" + previousReport.getSummary() + "\n";
        }

        return basePrompt;
    }

    private String buildUserPrompt(String reportType, String contextData,
                                    LocalDateTime periodStart, LocalDateTime periodEnd) {
        String periodStr = periodStart.format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm"))
                + " a " + periodEnd.format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm"));

        return "Genera el reporte " + reportType + " para el período: " + periodStr + "\n\n"
                + "Datos del SOC:\n" + contextData;
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
        body.put("max_tokens", agentMaxTokens);
        body.put("system", systemPrompt);
        body.put("messages", List.of(Map.of("role", "user", "content", userMessage)));

        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(body, headers);

        ResponseEntity<Map> response = restTemplate.exchange(
                CLAUDE_API_URL, HttpMethod.POST, entity, Map.class);

        return response.getBody();
    }

    @SuppressWarnings("unchecked")
    private String extractContent(Map<String, Object> apiResponse) {
        if (apiResponse == null) return "No response from AI";
        List<Map<String, Object>> content = (List<Map<String, Object>>) apiResponse.get("content");
        if (content != null && !content.isEmpty()) {
            return (String) content.get(0).get("text");
        }
        return "No response from AI";
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

    private String extractSummary(String content) {
        if (content == null) return null;
        // Take first 500 chars or until second newline block
        String trimmed = content.trim();
        int cutoff = Math.min(trimmed.length(), 500);

        // Try to cut at a paragraph boundary
        int doubleNewline = trimmed.indexOf("\n\n", 200);
        if (doubleNewline > 0 && doubleNewline < 600) {
            cutoff = doubleNewline;
        }

        return trimmed.substring(0, cutoff) + (trimmed.length() > cutoff ? "..." : "");
    }

    // ===== SLACK NOTIFICATION =====

    private void sendSlackReport(AiAgentReport report) {
        String emoji = "OFFENSIVE".equals(report.getReportType()) ? ":crossed_swords:" : ":shield:";
        String header = emoji + " *BlackWolf AI Agent - " + report.getReportType() + " Report*\n"
                + "*" + report.getTitle() + "*\n"
                + "Amenazas analizadas: " + report.getThreatsAnalyzed()
                + " | Incidentes: " + report.getIncidentsAnalyzed() + "\n"
                + "───────────────────────────\n";

        String fullText = header + report.getContent();

        // Split into chunks to respect Slack's message size limit
        List<String> chunks = splitIntoChunks(fullText, SLACK_CHUNK_SIZE);

        for (int i = 0; i < chunks.size(); i++) {
            String chunkText = chunks.get(i);
            if (chunks.size() > 1) {
                chunkText += "\n_(" + (i + 1) + "/" + chunks.size() + ")_";
            }

            try {
                Map<String, String> payload = Map.of("text", chunkText);
                restTemplate.postForEntity(slackWebhook, payload, String.class);

                // Small delay between chunks to avoid rate limiting
                if (i < chunks.size() - 1) {
                    Thread.sleep(500);
                }
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                break;
            } catch (Exception e) {
                log.error("AI Agent: Slack chunk {}/{} failed: {}", i + 1, chunks.size(), e.getMessage());
                throw e;
            }
        }

        log.info("AI Agent: Slack report sent ({} chunks)", chunks.size());
    }

    private List<String> splitIntoChunks(String text, int maxSize) {
        List<String> chunks = new ArrayList<>();
        int start = 0;
        while (start < text.length()) {
            int end = Math.min(start + maxSize, text.length());
            // Try to break at a newline
            if (end < text.length()) {
                int lastNewline = text.lastIndexOf('\n', end);
                if (lastNewline > start) {
                    end = lastNewline + 1;
                }
            }
            chunks.add(text.substring(start, end));
            start = end;
        }
        return chunks;
    }

    // ===== REPORT RETRIEVAL =====

    public List<AiAgentReport> getReports(String companyId, String reportType) {
        if (reportType != null && !reportType.isBlank()) {
            return reportRepository.findByCompanyIdAndReportTypeOrderByCreatedAtDesc(companyId, reportType.toUpperCase());
        }
        return reportRepository.findByCompanyIdOrderByCreatedAtDesc(companyId);
    }

    public Optional<AiAgentReport> getReport(String id) {
        return reportRepository.findById(id);
    }
}
