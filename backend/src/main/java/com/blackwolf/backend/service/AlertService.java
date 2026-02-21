package com.blackwolf.backend.service;

import com.blackwolf.backend.dto.AlertDTOs.*;
import com.blackwolf.backend.model.AlertConfiguration;
import com.blackwolf.backend.model.AlertHistory;
import com.blackwolf.backend.model.Company;
import com.blackwolf.backend.model.ThreatEvent;
import com.blackwolf.backend.repository.AlertConfigurationRepository;
import com.blackwolf.backend.repository.AlertHistoryRepository;
import com.blackwolf.backend.repository.CompanyRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class AlertService {

    private static final Logger log = LoggerFactory.getLogger(AlertService.class);

    @Autowired
    private AlertConfigurationRepository configRepository;

    @Autowired
    private AlertHistoryRepository historyRepository;

    @Autowired(required = false)
    private JavaMailSender mailSender;

    @Autowired
    private CompanyRepository companyRepository;

    @Value("${alerts.from-email:soc@blackwolf.io}")
    private String fromEmail;

    @Value("${alerts.global-slack-webhook:}")
    private String globalSlackWebhook;

    @Value("${alerts.global-slack-enabled:false}")
    private boolean globalSlackEnabled;

    private final RestTemplate restTemplate = new RestTemplate();

    public List<AlertConfiguration> listByCompany(String companyId) {
        return configRepository.findByCompanyId(companyId);
    }

    public List<AlertHistory> getHistory(String companyId) {
        return historyRepository.findByCompanyIdOrderBySentAtDesc(companyId);
    }

    public AlertConfiguration createConfig(String companyId, CreateAlertConfigRequest request) {
        AlertConfiguration config = new AlertConfiguration();
        config.setId(UUID.randomUUID().toString());
        config.setCompanyId(companyId);
        config.setAlertType(request.getAlertType());
        config.setDestination(request.getDestination());
        config.setMinSeverity(request.getMinSeverity() != null ? request.getMinSeverity() : 7);
        config.setActive(true);
        config.setCreatedAt(LocalDateTime.now());
        return configRepository.save(config);
    }

    public AlertConfiguration updateConfig(String id, UpdateAlertConfigRequest request) {
        AlertConfiguration config = configRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Alert config not found"));
        if (request.getDestination() != null) config.setDestination(request.getDestination());
        if (request.getMinSeverity() != null) config.setMinSeverity(request.getMinSeverity());
        if (request.getIsActive() != null) config.setActive(request.getIsActive());
        return configRepository.save(config);
    }

    public void deleteConfig(String id) {
        configRepository.deleteById(id);
    }

    // Fire alerts for a threat event
    public void fireAlertsForThreat(ThreatEvent threat) {
        String companyName = getCompanyName(threat.getCompanyId());

        // Per-company alerts
        List<AlertConfiguration> configs = configRepository.findByCompanyIdAndIsActiveTrue(threat.getCompanyId());
        for (AlertConfiguration config : configs) {
            if (threat.getSeverity() != null && threat.getSeverity() >= config.getMinSeverity()) {
                String subject = "[BlackWolf SOC] " + threat.getThreatType() + " - Severity " + threat.getSeverity();
                String message = buildThreatMessage(threat);

                try {
                    switch (config.getAlertType()) {
                        case "email" -> sendEmail(config.getDestination(), subject, message);
                        case "slack" -> sendSlack(config.getDestination(), subject, message);
                        case "webhook" -> sendWebhook(config.getDestination(), threat);
                    }
                    saveHistory(threat.getCompanyId(), config, threat.getId(), null, subject, message, "sent");
                } catch (Exception e) {
                    log.error("Failed to send alert: {}", e.getMessage());
                    saveHistory(threat.getCompanyId(), config, threat.getId(), null, subject, message, "failed");
                }
            }
        }

        // Global Slack per-event alerts disabled.
        // Consolidated reports are sent every 6 hours by AiThreatAnalystService.
    }

    // Fire alerts for an incident
    public void fireAlertsForIncident(String companyId, String incidentId, String title, String severity) {
        String companyName = getCompanyName(companyId);

        // Per-company alerts
        List<AlertConfiguration> configs = configRepository.findByCompanyIdAndIsActiveTrue(companyId);
        int severityNum = switch (severity) {
            case "critical" -> 10;
            case "high" -> 8;
            case "medium" -> 5;
            default -> 3;
        };

        for (AlertConfiguration config : configs) {
            if (severityNum >= config.getMinSeverity()) {
                String subject = "[BlackWolf SOC] INCIDENT: " + title;
                String message = "New incident created: " + title + "\nSeverity: " + severity + "\nID: " + incidentId;

                try {
                    switch (config.getAlertType()) {
                        case "email" -> sendEmail(config.getDestination(), subject, message);
                        case "slack" -> sendSlack(config.getDestination(), subject, message);
                    }
                    saveHistory(companyId, config, null, incidentId, subject, message, "sent");
                } catch (Exception e) {
                    log.error("Failed to send incident alert: {}", e.getMessage());
                    saveHistory(companyId, config, null, incidentId, subject, message, "failed");
                }
            }
        }

        // Global Slack per-event alerts disabled.
        // Consolidated reports are sent every 6 hours by AiThreatAnalystService.
    }

    private void sendEmail(String to, String subject, String body) {
        if (mailSender == null) {
            log.warn("Mail sender not configured, skipping email to {}", to);
            return;
        }
        SimpleMailMessage msg = new SimpleMailMessage();
        msg.setFrom(fromEmail);
        msg.setTo(to);
        msg.setSubject(subject);
        msg.setText(body);
        mailSender.send(msg);
        log.info("Email alert sent to {}", to);
    }

    private void sendSlack(String webhookUrl, String subject, String message) {
        try {
            Map<String, String> payload = Map.of("text", "*" + subject + "*\n" + message);
            restTemplate.postForEntity(webhookUrl, payload, String.class);
            log.info("Slack alert sent");
        } catch (Exception e) {
            log.error("Slack webhook failed: {}", e.getMessage());
            throw e;
        }
    }

    private void sendWebhook(String url, ThreatEvent threat) {
        try {
            restTemplate.postForEntity(url, threat, String.class);
            log.info("Webhook alert sent to {}", url);
        } catch (Exception e) {
            log.error("Webhook failed: {}", e.getMessage());
            throw e;
        }
    }

    private String buildThreatMessage(ThreatEvent t) {
        return String.format("""
                Threat Detected
                ─────────────────────────
                Type: %s
                Severity: %d/10
                Source IP: %s
                Target: %s:%d
                Description: %s
                Status: %s
                Time: %s
                ─────────────────────────
                BlackWolf SOC - Automated Alert
                """,
                t.getThreatType(), t.getSeverity(), t.getSrcIp(),
                t.getDstIp(), t.getDstPort(), t.getDescription(),
                t.getStatus(), t.getTimestamp());
    }

    // ===== Global Slack Channel =====

    private void sendGlobalSlackThreat(ThreatEvent t, String companyName) {
        if (!globalSlackEnabled || globalSlackWebhook == null || globalSlackWebhook.isBlank()) return;

        String emoji = t.getSeverity() >= 8 ? ":rotating_light:" : t.getSeverity() >= 5 ? ":warning:" : ":information_source:";
        String severityBar = "`" + "█".repeat(t.getSeverity()) + "░".repeat(10 - t.getSeverity()) + "` " + t.getSeverity() + "/10";

        String text = String.format("""
                %s *THREAT DETECTED*
                *Company:* %s
                *Type:* %s
                *Severity:* %s
                *Source:* `%s` → `%s:%d`
                *Description:* %s
                *Status:* %s
                *Time:* %s""",
                emoji, companyName, t.getThreatType(), severityBar,
                t.getSrcIp(), t.getDstIp(), t.getDstPort(),
                t.getDescription() != null ? t.getDescription() : "-",
                t.getStatus(), t.getTimestamp());

        try {
            Map<String, String> payload = Map.of("text", text);
            restTemplate.postForEntity(globalSlackWebhook, payload, String.class);
            log.info("Global Slack alert sent for {} - {}", companyName, t.getThreatType());
        } catch (Exception e) {
            log.error("Global Slack alert failed: {}", e.getMessage());
        }
    }

    private void sendGlobalSlackIncident(String companyName, String incidentId, String title, String severity) {
        if (!globalSlackEnabled || globalSlackWebhook == null || globalSlackWebhook.isBlank()) return;

        String emoji = switch (severity) {
            case "critical" -> ":red_circle:";
            case "high" -> ":orange_circle:";
            case "medium" -> ":yellow_circle:";
            default -> ":white_circle:";
        };

        String text = String.format("""
                %s *NEW INCIDENT*
                *Company:* %s
                *Title:* %s
                *Severity:* %s
                *ID:* `%s`""",
                emoji, companyName, title, severity.toUpperCase(), incidentId);

        try {
            Map<String, String> payload = Map.of("text", text);
            restTemplate.postForEntity(globalSlackWebhook, payload, String.class);
            log.info("Global Slack incident alert sent for {}", companyName);
        } catch (Exception e) {
            log.error("Global Slack incident alert failed: {}", e.getMessage());
        }
    }

    private String getCompanyName(String companyId) {
        return companyRepository.findById(companyId)
                .map(Company::getCompanyName)
                .orElse("Unknown Company");
    }

    private void saveHistory(String companyId, AlertConfiguration config, String threatId, String incidentId, String subject, String message, String status) {
        AlertHistory h = new AlertHistory();
        h.setId(UUID.randomUUID().toString());
        h.setCompanyId(companyId);
        h.setAlertConfigId(config.getId());
        h.setThreatEventId(threatId);
        h.setIncidentId(incidentId);
        h.setAlertType(config.getAlertType());
        h.setDestination(config.getDestination());
        h.setSubject(subject);
        h.setMessage(message);
        h.setStatus(status);
        h.setSentAt(LocalDateTime.now());
        historyRepository.save(h);
    }
}
