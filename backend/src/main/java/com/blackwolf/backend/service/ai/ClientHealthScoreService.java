package com.blackwolf.backend.service.ai;

import com.blackwolf.backend.model.Company;
import com.blackwolf.backend.repository.*;
import com.blackwolf.backend.service.EmailTemplateService;
import jakarta.mail.internet.MimeMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.*;

@Service
public class ClientHealthScoreService {

    private static final Logger log = LoggerFactory.getLogger(ClientHealthScoreService.class);

    @Autowired private CompanyRepository companyRepository;
    @Autowired private SensorRepository sensorRepository;
    @Autowired private ThreatEventRepository threatEventRepository;
    @Autowired private IncidentRepository incidentRepository;
    @Autowired private AiDecisionRepository aiDecisionRepository;
    @Autowired private EmailTemplateService emailTemplateService;
    @Autowired(required = false) private JavaMailSender mailSender;

    @Value("${alerts.from-email:soc@blackwolf.io}")
    private String fromEmail;

    /**
     * Calculate health score 0-100 for a company.
     * Evaluates: sensor activity, threat response time, feature adoption, AI accuracy.
     */
    public Map<String, Object> calculateHealthScore(String companyId) {
        Map<String, Object> result = new LinkedHashMap<>();
        int totalScore = 0;
        List<String> issues = new ArrayList<>();
        List<String> recommendations = new ArrayList<>();

        // 1. Sensor Activity (0-25 points)
        int sensorScore = 0;
        long activeSensors = sensorRepository.findByCompanyId(companyId).stream()
                .filter(s -> "online".equals(s.getStatus()))
                .count();
        long totalSensors = sensorRepository.findByCompanyId(companyId).stream()
                .filter(s -> !Boolean.TRUE.equals(s.getIsTemplate()))
                .count();

        if (totalSensors == 0) {
            issues.add("No sensors deployed");
            recommendations.add("Deploy at least one sensor from the catalog to start monitoring");
        } else {
            double sensorRatio = (double) activeSensors / totalSensors;
            sensorScore = (int) (sensorRatio * 25);
            if (sensorRatio < 0.5) {
                issues.add(activeSensors + "/" + totalSensors + " sensors are online");
                recommendations.add("Check offline sensors and verify connectivity");
            }
        }
        totalScore += sensorScore;
        result.put("sensorScore", sensorScore);

        // 2. Threat Detection Volume (0-25 points)
        int threatScore = 0;
        long recentThreats = threatEventRepository.countByCompanyIdAndTimestampAfter(
                companyId, LocalDateTime.now().minusDays(7));
        if (recentThreats > 0) {
            threatScore = Math.min(25, (int) (Math.log(recentThreats + 1) * 5));
        } else if (totalSensors > 0) {
            issues.add("No threats detected in last 7 days");
            recommendations.add("Verify sensor configurations are capturing traffic");
        }
        totalScore += threatScore;
        result.put("threatScore", threatScore);

        // 3. Incident Response (0-25 points)
        int incidentScore = 15; // Base score
        long openIncidents = incidentRepository.countByCompanyIdAndStatus(companyId, "open");
        long totalIncidents = incidentRepository.countByCompanyId(companyId);
        if (totalIncidents > 0) {
            double resolvedRatio = 1.0 - ((double) openIncidents / totalIncidents);
            incidentScore = (int) (resolvedRatio * 25);
            if (openIncidents > 10) {
                issues.add(openIncidents + " unresolved incidents");
                recommendations.add("Review and triage open incidents to reduce backlog");
            }
        }
        totalScore += incidentScore;
        result.put("incidentScore", incidentScore);

        // 4. Platform Adoption (0-25 points)
        int adoptionScore = 0;
        if (totalSensors > 0) adoptionScore += 5;
        if (recentThreats > 0) adoptionScore += 5;
        if (totalIncidents > 0) adoptionScore += 5;
        long aiDecisions = aiDecisionRepository.countByCompanyId(companyId);
        if (aiDecisions > 0) adoptionScore += 5;
        // Check if they have playbooks
        adoptionScore += 5; // Base adoption points
        totalScore += adoptionScore;
        result.put("adoptionScore", adoptionScore);

        result.put("totalScore", totalScore);
        result.put("issues", issues);
        result.put("recommendations", recommendations);
        result.put("grade", totalScore >= 80 ? "A" : totalScore >= 60 ? "B" : totalScore >= 40 ? "C" : totalScore >= 20 ? "D" : "F");

        return result;
    }

    /**
     * Get all companies with low health scores for proactive outreach.
     */
    @Scheduled(cron = "0 0 8 * * MON") // Every Monday at 8 AM
    public void identifyAtRiskClients() {
        List<Company> companies = companyRepository.findAll();
        for (Company company : companies) {
            try {
                Map<String, Object> health = calculateHealthScore(company.getId());
                int score = (int) health.get("totalScore");

                if (score < 30) {
                    log.warn("CLIENT HEALTH: Company '{}' has critical health score: {} — {}",
                            company.getCompanyName(), score, health.get("issues"));
                    sendHealthAlertEmail(company, score, health);
                } else if (score < 50) {
                    log.info("CLIENT HEALTH: Company '{}' has low health score: {} — {}",
                            company.getCompanyName(), score, health.get("recommendations"));
                    sendHealthAlertEmail(company, score, health);
                }
            } catch (Exception e) {
                log.error("Failed to calculate health for company {}: {}", company.getId(), e.getMessage());
            }
        }
    }

    @SuppressWarnings("unchecked")
    private void sendHealthAlertEmail(Company company, int score, Map<String, Object> health) {
        if (mailSender == null || company.getContactEmail() == null) return;

        String grade = (String) health.getOrDefault("grade", "F");
        List<String> recommendations = (List<String>) health.getOrDefault("recommendations", List.of());

        StringBuilder body = new StringBuilder();
        body.append("Health Score: ").append(score).append("/100 (Grade ").append(grade).append(")\n\n");
        body.append("Your SOC platform health needs attention. Here are our recommendations:\n\n");
        for (int i = 0; i < recommendations.size(); i++) {
            body.append(i + 1).append(". ").append(recommendations.get(i)).append("\n");
        }
        body.append("\nLog in to your dashboard to take action.");

        try {
            String htmlContent = emailTemplateService.renderAlertHtml(
                    "Health Score Alert — " + company.getCompanyName(), body.toString());

            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
            helper.setFrom(fromEmail, "BlackWolf SOC");
            helper.setTo(company.getContactEmail());
            helper.setSubject("[BlackWolf] Health Alert: Score " + score + "/100 — Action Required");
            helper.setText(htmlContent, true);
            mailSender.send(message);
            log.info("Health alert email sent to {} (score: {})", company.getContactEmail(), score);
        } catch (Exception e) {
            log.error("Failed to send health alert to {}: {}", company.getContactEmail(), e.getMessage());
        }
    }
}
