package com.blackwolf.backend.service.ai;

import com.blackwolf.backend.model.Company;
import com.blackwolf.backend.repository.CompanyRepository;
import com.blackwolf.backend.repository.SensorRepository;
import com.blackwolf.backend.repository.ThreatEventRepository;
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
public class AutomatedOnboardingAgent {

    private static final Logger log = LoggerFactory.getLogger(AutomatedOnboardingAgent.class);

    @Autowired private CompanyRepository companyRepository;
    @Autowired private SensorRepository sensorRepository;
    @Autowired private ThreatEventRepository threatEventRepository;
    @Autowired private ClientHealthScoreService healthScoreService;
    @Autowired private EmailTemplateService emailTemplateService;
    @Autowired(required = false) private JavaMailSender mailSender;

    @Value("${alerts.from-email:soc@blackwolf.io}")
    private String fromEmail;

    /**
     * Analyze new companies in their first 24 hours and provide guidance.
     * Runs every hour.
     */
    @Scheduled(fixedRate = 3600000) // every hour
    public void analyzeNewCompanies() {
        LocalDateTime oneDayAgo = LocalDateTime.now().minusHours(24);
        List<Company> newCompanies = companyRepository.findByRegisteredAtAfter(oneDayAgo);

        for (Company company : newCompanies) {
            try {
                analyzeAndGuide(company);
            } catch (Exception e) {
                log.error("Onboarding analysis failed for company {}: {}", company.getId(), e.getMessage());
            }
        }
    }

    private void analyzeAndGuide(Company company) {
        String companyId = company.getId();

        // Check if they have sensors
        long sensorCount = sensorRepository.findByCompanyId(companyId).stream()
                .filter(s -> !Boolean.TRUE.equals(s.getIsTemplate()))
                .count();

        // Check if they have events
        long eventCount = threatEventRepository.countByCompanyId(companyId);

        List<String> nextSteps = new ArrayList<>();

        if (sensorCount == 0) {
            nextSteps.add("Deploy your first sensor from the catalog (Suricata IDS or Auth Monitor)");
            // Send sensor deployment guide email
            sendOnboardingEmail(company, "Deploy Your First Sensor",
                    emailTemplateService.renderDeploySensor(company.getCompanyName(), ""));
            log.info("ONBOARDING: Company '{}' needs sensor deployment — email sent", company.getCompanyName());
        } else if (eventCount == 0) {
            nextSteps.add("Sensors deployed but no events received. Check sensor connectivity.");
            log.info("ONBOARDING: Company '{}' has sensors but no events", company.getCompanyName());
        } else {
            nextSteps.add("Events flowing. Configure alert rules and deploy playbooks.");
            log.info("ONBOARDING: Company '{}' is receiving events ({}). Ready for next steps.", company.getCompanyName(), eventCount);
        }

        // Calculate initial health score
        Map<String, Object> health = healthScoreService.calculateHealthScore(companyId);

        log.info("ONBOARDING ANALYSIS: {} — score: {}, sensors: {}, events: {}",
                company.getCompanyName(), health.get("totalScore"), sensorCount, eventCount);
    }

    private void sendOnboardingEmail(Company company, String subject, String htmlContent) {
        if (mailSender == null || company.getContactEmail() == null) {
            log.warn("Cannot send onboarding email: mailSender={}, contactEmail={}",
                    mailSender != null ? "configured" : "null", company.getContactEmail());
            return;
        }
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
            helper.setFrom(fromEmail, "BlackWolf SOC");
            helper.setTo(company.getContactEmail());
            helper.setSubject("[BlackWolf] " + subject);
            helper.setText(htmlContent, true);
            mailSender.send(message);
            log.info("Onboarding email '{}' sent to {}", subject, company.getContactEmail());
        } catch (Exception e) {
            log.error("Failed to send onboarding email to {}: {}", company.getContactEmail(), e.getMessage());
        }
    }
}
