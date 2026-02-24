package com.blackwolf.backend.service.ai;

import com.blackwolf.backend.model.Company;
import com.blackwolf.backend.repository.CompanyRepository;
import com.blackwolf.backend.repository.ThreatEventRepository;
import com.blackwolf.backend.repository.IncidentRepository;
import com.blackwolf.backend.repository.AiDecisionRepository;
import com.blackwolf.backend.repository.BlockedIPRepository;
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
public class ValueDeliveryAgent {

    private static final Logger log = LoggerFactory.getLogger(ValueDeliveryAgent.class);

    @Autowired private CompanyRepository companyRepository;
    @Autowired private ThreatEventRepository threatEventRepository;
    @Autowired private IncidentRepository incidentRepository;
    @Autowired private AiDecisionRepository aiDecisionRepository;
    @Autowired private BlockedIPRepository blockedIPRepository;
    @Autowired private ClientHealthScoreService healthScoreService;
    @Autowired private EmailTemplateService emailTemplateService;
    @Autowired(required = false) private JavaMailSender mailSender;

    @Value("${alerts.from-email:soc@blackwolf.io}")
    private String fromEmail;

    /**
     * Generate weekly value reports for each company.
     * Summarizes threats blocked, incidents resolved, AI actions taken.
     */
    @Scheduled(cron = "0 0 9 * * MON") // Every Monday at 9 AM
    public void generateWeeklyValueReports() {
        log.info("VALUE DELIVERY: Generating weekly value reports...");

        List<Company> companies = companyRepository.findAll();
        for (Company company : companies) {
            try {
                Map<String, Object> report = generateValueReport(company.getId(), 7);

                // Send the weekly report email
                int threats = ((Number) report.getOrDefault("threatsDetected", 0)).intValue();
                int incidents = ((Number) report.getOrDefault("incidentsCreated", 0)).intValue();
                int blockedIps = blockedIPRepository.findByCompanyId(company.getId()).size();

                sendWeeklyReportEmail(company, threats, incidents, blockedIps);

                log.info("VALUE REPORT for '{}': {} threats, {} incidents, health score {} — email sent",
                        company.getCompanyName(), threats, incidents, report.get("healthScore"));
            } catch (Exception e) {
                log.error("Failed to generate value report for company {}: {}", company.getId(), e.getMessage());
            }
        }
    }

    /**
     * Generate a value report for a specific company.
     */
    public Map<String, Object> generateValueReport(String companyId, int days) {
        LocalDateTime since = LocalDateTime.now().minusDays(days);

        long threatsDetected = threatEventRepository.countByCompanyIdAndTimestampAfter(companyId, since);
        long incidentsCreated = incidentRepository.countByCompanyIdAndCreatedAtAfter(companyId, since);
        long incidentsResolved = incidentRepository.countByCompanyIdAndStatusAndUpdatedAtAfter(
                companyId, "resolved", since);
        long aiDecisions = aiDecisionRepository.countByCompanyIdAndCreatedAtAfter(companyId, since);

        Map<String, Object> health = healthScoreService.calculateHealthScore(companyId);

        Map<String, Object> report = new LinkedHashMap<>();
        report.put("companyId", companyId);
        report.put("period", days + " days");
        report.put("generatedAt", LocalDateTime.now().toString());

        // Key metrics
        report.put("threatsDetected", threatsDetected);
        report.put("incidentsCreated", incidentsCreated);
        report.put("incidentsResolved", incidentsResolved);
        report.put("aiDecisions", aiDecisions);
        report.put("healthScore", health.get("totalScore"));
        report.put("healthGrade", health.get("grade"));

        // Value highlights
        List<String> highlights = new ArrayList<>();
        if (threatsDetected > 0) {
            highlights.add("Detected and analyzed " + threatsDetected + " threats in the last " + days + " days");
        }
        if (aiDecisions > 0) {
            highlights.add("AI agent autonomously processed " + aiDecisions + " decisions");
        }
        if (incidentsResolved > 0) {
            highlights.add("Successfully resolved " + incidentsResolved + " security incidents");
        }
        report.put("highlights", highlights);

        // Recommendations from health score
        report.put("recommendations", health.get("recommendations"));

        return report;
    }

    private void sendWeeklyReportEmail(Company company, int threats, int incidents, int blockedIps) {
        if (mailSender == null || company.getContactEmail() == null) {
            log.warn("Cannot send weekly report: mailSender={}, contactEmail={}",
                    mailSender != null ? "configured" : "null", company.getContactEmail());
            return;
        }
        try {
            String htmlContent = emailTemplateService.renderWeeklyReport(
                    company.getCompanyName(), threats, incidents, blockedIps);

            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
            helper.setFrom(fromEmail, "BlackWolf SOC");
            helper.setTo(company.getContactEmail());
            helper.setSubject("[BlackWolf] Weekly Security Report — " + company.getCompanyName());
            helper.setText(htmlContent, true);
            mailSender.send(message);
            log.info("Weekly report email sent to {}", company.getContactEmail());
        } catch (Exception e) {
            log.error("Failed to send weekly report email to {}: {}", company.getContactEmail(), e.getMessage());
        }
    }
}
