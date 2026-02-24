package com.blackwolf.backend.service;

import com.blackwolf.backend.model.EmailSequenceJob;
import com.blackwolf.backend.repository.EmailSequenceJobRepository;
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
import java.util.List;
import java.util.UUID;

@Service
public class EmailSequenceService {

    private static final Logger log = LoggerFactory.getLogger(EmailSequenceService.class);

    @Autowired
    private EmailSequenceJobRepository jobRepository;

    @Autowired(required = false)
    private JavaMailSender mailSender;

    @Autowired
    private EmailTemplateService templateService;

    @Value("${alerts.from-email:soc@blackwolf.io}")
    private String fromEmail;

    /**
     * Schedule the full onboarding drip sequence for a newly provisioned company.
     */
    public void scheduleOnboardingSequence(String companyId, String recipientEmail,
                                            String companyName, String tempPassword) {
        LocalDateTime now = LocalDateTime.now();

        // Email 1: Welcome (immediate)
        createJob(companyId, recipientEmail, "welcome",
                "Welcome to BlackWolf SOC — Your Dashboard is Ready",
                now,
                "{\"companyName\":\"%s\",\"email\":\"%s\",\"tempPassword\":\"%s\"}"
                        .formatted(companyName, recipientEmail, tempPassword));

        // Email 2: Deploy sensor (day 2)
        createJob(companyId, recipientEmail, "deploy_sensor",
                "Deploy Your First Sensor — Start Monitoring in Minutes",
                now.plusDays(2),
                "{\"companyName\":\"%s\"}".formatted(companyName));

        // Email 3: Weekly summary (day 7)
        createJob(companyId, recipientEmail, "weekly_report",
                "Your First Week Security Summary",
                now.plusDays(7),
                "{\"companyName\":\"%s\"}".formatted(companyName));

        // Email 4: Trial ending (day 12)
        createJob(companyId, recipientEmail, "trial_ending",
                "Your Trial Ends in 2 Days — Choose Your Plan",
                now.plusDays(12),
                "{\"companyName\":\"%s\",\"daysLeft\":\"2\"}".formatted(companyName));

        log.info("Scheduled 4 onboarding emails for {} ({})", companyName, recipientEmail);
    }

    /**
     * Process pending email jobs every 5 minutes.
     */
    @Scheduled(fixedRate = 300000)
    public void processEmailQueue() {
        List<EmailSequenceJob> pending = jobRepository
                .findByStatusAndScheduledAtBeforeOrderByScheduledAtAsc("pending", LocalDateTime.now());

        if (pending.isEmpty()) return;

        log.info("Processing {} pending email jobs", pending.size());

        for (EmailSequenceJob job : pending) {
            try {
                sendSequenceEmail(job);
                job.setStatus("sent");
                job.setSentAt(LocalDateTime.now());
                job.setAttempts(job.getAttempts() + 1);
            } catch (Exception e) {
                log.error("Failed to send email job {}: {}", job.getId(), e.getMessage());
                job.setAttempts(job.getAttempts() + 1);
                job.setErrorMessage(e.getMessage());
                if (job.getAttempts() >= 3) {
                    job.setStatus("failed");
                    log.warn("Email job {} permanently failed after {} attempts", job.getId(), job.getAttempts());
                }
            }
            jobRepository.save(job);
        }
    }

    /**
     * Cancel all pending emails for a company (e.g., on cancellation).
     */
    public void cancelPendingEmails(String companyId) {
        List<EmailSequenceJob> pending = jobRepository.findByCompanyIdAndStatus(companyId, "pending");
        for (EmailSequenceJob job : pending) {
            job.setStatus("cancelled");
            jobRepository.save(job);
        }
        log.info("Cancelled {} pending emails for company {}", pending.size(), companyId);
    }

    public List<EmailSequenceJob> getJobsByCompany(String companyId) {
        return jobRepository.findByCompanyIdOrderByScheduledAtAsc(companyId);
    }

    private void sendSequenceEmail(EmailSequenceJob job) throws Exception {
        if (mailSender == null) {
            log.warn("Mail sender not configured, marking job {} as sent (dry run)", job.getId());
            return;
        }

        String htmlContent = renderTemplate(job);

        MimeMessage message = mailSender.createMimeMessage();
        MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
        helper.setFrom(fromEmail, "BlackWolf SOC");
        helper.setTo(job.getRecipient());
        helper.setSubject(job.getSubject());
        helper.setText(htmlContent, true);

        mailSender.send(message);
        log.info("Sent {} email to {}", job.getEmailType(), job.getRecipient());
    }

    private String renderTemplate(EmailSequenceJob job) {
        String meta = job.getMetadata() != null ? job.getMetadata() : "{}";

        return switch (job.getEmailType()) {
            case "welcome" -> templateService.renderWelcome(
                    extractJson(meta, "companyName"),
                    extractJson(meta, "email"),
                    extractJson(meta, "tempPassword"));
            case "deploy_sensor" -> templateService.renderDeploySensor(
                    extractJson(meta, "companyName"),
                    "YOUR_API_KEY");
            case "weekly_report" -> templateService.renderWeeklyReport(
                    extractJson(meta, "companyName"), 0, 0, 0);
            case "trial_ending" -> templateService.renderTrialEnding(
                    extractJson(meta, "companyName"),
                    Integer.parseInt(extractJson(meta, "daysLeft")));
            default -> templateService.renderAlertHtml(job.getSubject(), "");
        };
    }

    private void createJob(String companyId, String recipient, String emailType,
                           String subject, LocalDateTime scheduledAt, String metadata) {
        EmailSequenceJob job = new EmailSequenceJob();
        job.setId(UUID.randomUUID().toString());
        job.setCompanyId(companyId);
        job.setRecipient(recipient);
        job.setEmailType(emailType);
        job.setSubject(subject);
        job.setScheduledAt(scheduledAt);
        job.setStatus("pending");
        job.setAttempts(0);
        job.setMetadata(metadata);
        job.setCreatedAt(LocalDateTime.now());
        jobRepository.save(job);
    }

    private String extractJson(String json, String key) {
        try {
            String search = "\"" + key + "\":\"";
            int start = json.indexOf(search);
            if (start < 0) return "";
            start += search.length();
            int end = json.indexOf("\"", start);
            return end > start ? json.substring(start, end) : "";
        } catch (Exception e) {
            return "";
        }
    }
}
