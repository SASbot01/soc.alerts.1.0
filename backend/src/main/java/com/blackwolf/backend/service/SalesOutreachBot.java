package com.blackwolf.backend.service;

import com.blackwolf.backend.model.OutreachLog;
import com.blackwolf.backend.model.OutreachMetric;
import com.blackwolf.backend.model.Prospect;
import com.blackwolf.backend.repository.OutreachLogRepository;
import com.blackwolf.backend.repository.OutreachMetricRepository;
import com.blackwolf.backend.repository.ProspectRepository;
import jakarta.mail.internet.MimeMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;

/**
 * Autonomous Sales Outreach Bot.
 *
 * Responsibilities:
 * 1. Send cold outreach email sequences to prospects daily
 * 2. Track delivery, opens, clicks, replies
 * 3. Self-improve by analyzing what works best
 * 4. Manage prospect lifecycle (new → contacted → engaged → converted)
 *
 * Drip sequence:
 *   Step 1 (Day 0):  Intro — "Is Your Infrastructure Protected?"    → /landing
 *   Step 2 (Day 3):  Value — "What BlackWolf Detects Every Day"     → /pricing
 *   Step 3 (Day 7):  Social Proof — "Don't Be the Next Headline"   → /landing
 *   Step 4 (Day 14): Urgency — "Still Unprotected?"                → /landing
 */
@Service
public class SalesOutreachBot {

    private static final Logger log = LoggerFactory.getLogger(SalesOutreachBot.class);

    // Default intervals between emails (days). Self-improvement can adjust these.
    private int[] stepIntervals = {0, 3, 7, 14};

    // Max emails per day (to avoid spam reputation issues)
    @Value("${outreach.max-emails-per-day:50}")
    private int maxEmailsPerDay;

    @Autowired private ProspectRepository prospectRepository;
    @Autowired private OutreachLogRepository outreachLogRepository;
    @Autowired private OutreachMetricRepository metricRepository;
    @Autowired private EmailTemplateService emailTemplateService;
    @Autowired(required = false) private JavaMailSender mailSender;

    @Value("${alerts.from-email:soc@blackwolf.io}")
    private String fromEmail;

    // ─── DAILY OUTREACH: runs every day at 10 AM ──────────────────────────

    @Scheduled(cron = "0 0 10 * * *")
    @Transactional
    public void runDailyOutreach() {
        if (mailSender == null) {
            log.warn("OUTREACH BOT: Mail sender not configured, skipping daily outreach");
            return;
        }

        log.info("═══════════════════════════════════════════════════════");
        log.info("  OUTREACH BOT: Starting daily outreach cycle...");
        log.info("═══════════════════════════════════════════════════════");

        int sent = 0;
        LocalDateTime now = LocalDateTime.now();

        // 1. Get prospects ready for their next email
        List<Prospect> readyProspects = prospectRepository
                .findByStatusInAndNextEmailAtBeforeOrderByScoreDesc(
                        List.of("new", "contacted", "engaged"), now);

        log.info("OUTREACH BOT: Found {} prospects ready for next email", readyProspects.size());

        for (Prospect prospect : readyProspects) {
            if (sent >= maxEmailsPerDay) {
                log.info("OUTREACH BOT: Daily limit reached ({} emails). Remaining will be sent tomorrow.", maxEmailsPerDay);
                break;
            }

            try {
                boolean emailSent = sendNextSequenceEmail(prospect);
                if (emailSent) sent++;
            } catch (Exception e) {
                log.error("OUTREACH BOT: Failed to process prospect {}: {}", prospect.getEmail(), e.getMessage());
            }
        }

        // 2. Initialize new prospects that haven't been scheduled yet
        List<Prospect> newProspects = prospectRepository.findByStatusOrderByCreatedAtDesc("new");
        for (Prospect prospect : newProspects) {
            if (prospect.getSequenceStep() == 0 && prospect.getNextEmailAt() == null) {
                prospect.setNextEmailAt(now); // Send immediately on next run
                prospectRepository.save(prospect);
            }
        }

        log.info("OUTREACH BOT: Daily cycle complete — {} emails sent", sent);
    }

    // ─── SEND NEXT EMAIL IN SEQUENCE ──────────────────────────────────────

    private boolean sendNextSequenceEmail(Prospect prospect) throws Exception {
        int currentStep = prospect.getSequenceStep();
        int nextStep = currentStep + 1;

        if (nextStep > 4) {
            // Sequence complete
            if (!"engaged".equals(prospect.getStatus()) && !"converted".equals(prospect.getStatus())) {
                prospect.setStatus("contacted");
                prospect.setNotes((prospect.getNotes() != null ? prospect.getNotes() + "\n" : "") +
                        "[" + LocalDateTime.now() + "] Full sequence completed, no engagement");
            }
            prospect.setNextEmailAt(null);
            prospectRepository.save(prospect);
            return false;
        }

        // Build the email
        String subject;
        String htmlContent;
        String emailType;

        switch (nextStep) {
            case 1 -> {
                emailType = "outreach_intro";
                subject = "Is " + (prospect.getDomain() != null ? prospect.getDomain() : "your company") + " protected from cyber threats?";
                htmlContent = emailTemplateService.renderOutreachIntro(prospect.getContactName(), prospect.getDomain());
            }
            case 2 -> {
                emailType = "outreach_value";
                subject = "12,847 brute force attacks blocked last week — are you protected?";
                htmlContent = emailTemplateService.renderOutreachValue(prospect.getContactName());
            }
            case 3 -> {
                emailType = "outreach_social_proof";
                subject = "How companies like yours stop breaches before they happen";
                htmlContent = emailTemplateService.renderOutreachSocialProof(prospect.getContactName());
            }
            case 4 -> {
                emailType = "outreach_urgency";
                subject = "Last chance — activate your free SOC trial";
                htmlContent = emailTemplateService.renderOutreachUrgency(prospect.getContactName());
            }
            default -> {
                return false;
            }
        }

        // Send the email
        MimeMessage message = mailSender.createMimeMessage();
        MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
        helper.setFrom(fromEmail, "BlackWolf Security");
        helper.setTo(prospect.getEmail());
        helper.setSubject(subject);
        helper.setText(htmlContent, true);

        // Add unsubscribe header (email best practice)
        message.addHeader("List-Unsubscribe", "<mailto:" + fromEmail + "?subject=unsubscribe>");

        mailSender.send(message);

        // Log the outreach
        OutreachLog outreachLog = new OutreachLog();
        outreachLog.setProspectId(prospect.getId());
        outreachLog.setEmailType(emailType);
        outreachLog.setSubject(subject);
        outreachLog.setStatus("sent");
        outreachLogRepository.save(outreachLog);

        // Update prospect
        prospect.setSequenceStep(nextStep);
        prospect.setLastEmailAt(LocalDateTime.now());
        prospect.setStatus(nextStep == 1 ? "contacted" : prospect.getStatus());

        // Schedule next email
        if (nextStep < 4) {
            int daysUntilNext = stepIntervals[nextStep] > 0 ?
                    stepIntervals[nextStep] - (nextStep > 1 ? stepIntervals[nextStep - 1] : 0) : 3;
            // Ensure minimum gap is the interval for the NEXT step
            if (nextStep < stepIntervals.length) {
                int nextIntervalDay = stepIntervals[nextStep];
                int currentIntervalDay = nextStep > 0 ? stepIntervals[nextStep - 1] : 0;
                daysUntilNext = nextIntervalDay - currentIntervalDay;
            }
            prospect.setNextEmailAt(LocalDateTime.now().plusDays(daysUntilNext));
        } else {
            prospect.setNextEmailAt(null);
        }

        prospectRepository.save(prospect);

        log.info("OUTREACH BOT: Sent step {} ({}) to {} [{}]",
                nextStep, emailType, prospect.getEmail(),
                prospect.getCompanyName() != null ? prospect.getCompanyName() : "unknown");

        return true;
    }

    // ─── SELF-IMPROVEMENT: Daily analysis at 11 PM ────────────────────────

    @Scheduled(cron = "0 0 23 * * *")
    @Transactional
    public void selfImprove() {
        log.info("═══════════════════════════════════════════════════════");
        log.info("  OUTREACH BOT: Starting self-improvement analysis...");
        log.info("═══════════════════════════════════════════════════════");

        LocalDate today = LocalDate.now();
        LocalDateTime dayStart = today.atStartOfDay();

        // Calculate today's metrics
        long sent = outreachLogRepository.countBySentAtAfter(dayStart);
        long opened = outreachLogRepository.countByStatusAndSentAtAfter("opened", dayStart);
        long clicked = outreachLogRepository.countByStatusAndSentAtAfter("clicked", dayStart);
        long bounced = outreachLogRepository.countByStatusAndSentAtAfter("bounced", dayStart);
        long conversions = prospectRepository.countByStatusAndCreatedAtAfter("converted", dayStart);

        double openRate = sent > 0 ? (double) opened / sent : 0;
        double clickRate = sent > 0 ? (double) clicked / sent : 0;
        double conversionRate = sent > 0 ? (double) conversions / sent : 0;

        // Find best performing template today
        String bestTemplate = null;
        long bestClicks = 0;
        for (String type : List.of("outreach_intro", "outreach_value", "outreach_social_proof", "outreach_urgency")) {
            long typeClicks = outreachLogRepository.countByEmailTypeAndSentAtAfter(type, dayStart);
            if (typeClicks > bestClicks) {
                bestClicks = typeClicks;
                bestTemplate = type;
            }
        }

        // Store metrics
        OutreachMetric metric = metricRepository.findByMetricDate(today)
                .orElseGet(() -> {
                    OutreachMetric m = new OutreachMetric();
                    m.setMetricDate(today);
                    return m;
                });

        metric.setEmailsSent((int) sent);
        metric.setEmailsOpened((int) opened);
        metric.setEmailsClicked((int) clicked);
        metric.setEmailsBounced((int) bounced);
        metric.setConversions((int) conversions);
        metric.setOpenRate(openRate);
        metric.setClickRate(clickRate);
        metric.setConversionRate(conversionRate);
        metric.setBestPerformingTemplate(bestTemplate);

        // Self-improvement decisions
        List<String> improvements = new ArrayList<>();

        // Analyze last 7 days for trends
        LocalDate weekAgo = today.minusDays(7);
        List<OutreachMetric> weekMetrics = metricRepository
                .findByMetricDateBetweenOrderByMetricDateAsc(weekAgo, today);

        if (weekMetrics.size() >= 3) {
            double avgOpenRate = weekMetrics.stream()
                    .filter(m -> m.getOpenRate() != null)
                    .mapToDouble(OutreachMetric::getOpenRate)
                    .average().orElse(0);

            double avgClickRate = weekMetrics.stream()
                    .filter(m -> m.getClickRate() != null)
                    .mapToDouble(OutreachMetric::getClickRate)
                    .average().orElse(0);

            // If open rate is low, subjects need work
            if (avgOpenRate < 0.15 && sent > 10) {
                improvements.add("LOW OPEN RATE (" + String.format("%.1f%%", avgOpenRate * 100) +
                        ") — Consider A/B testing subject lines");
            }

            // If click rate is low but opens are ok, content needs work
            if (avgOpenRate > 0.20 && avgClickRate < 0.05 && sent > 10) {
                improvements.add("LOW CLICK RATE (" + String.format("%.1f%%", avgClickRate * 100) +
                        ") — CTAs need to be more compelling");
            }

            // If bounces are high, list quality is poor
            long totalBounced = weekMetrics.stream().mapToInt(OutreachMetric::getEmailsBounced).sum();
            long totalSent = weekMetrics.stream().mapToInt(OutreachMetric::getEmailsSent).sum();
            if (totalSent > 0 && (double) totalBounced / totalSent > 0.10) {
                improvements.add("HIGH BOUNCE RATE — Improve prospect list quality, verify emails before adding");
            }

            // Adjust intervals based on engagement patterns
            if (avgClickRate > 0.10) {
                // High engagement — speed up sequence
                if (stepIntervals[1] > 2) {
                    stepIntervals[1] = 2;
                    improvements.add("SPEED UP: Reduced step 2 delay to 2 days (high engagement)");
                }
            } else if (avgOpenRate < 0.10 && sent > 20) {
                // Low engagement — slow down to avoid spam
                if (stepIntervals[1] < 5) {
                    stepIntervals[1] = 5;
                    improvements.add("SLOW DOWN: Increased step 2 delay to 5 days (low engagement)");
                }
            }
        }

        // Store improvement notes
        if (!improvements.isEmpty()) {
            metric.setNotes(String.join("\n", improvements));
            log.info("OUTREACH BOT IMPROVEMENTS:");
            improvements.forEach(i -> log.info("  → {}", i));
        }

        metricRepository.save(metric);

        log.info("OUTREACH BOT METRICS: sent={}, opened={}, clicked={}, bounced={}, conversions={}",
                sent, opened, clicked, bounced, conversions);
        log.info("  Open rate: {:.1%}, Click rate: {:.1%}, Best template: {}",
                openRate, clickRate, bestTemplate);
    }

    // ─── PUBLIC API METHODS ───────────────────────────────────────────────

    /**
     * Add a single prospect manually.
     */
    @Transactional
    public Prospect addProspect(String email, String companyName, String domain,
                                 String contactName, String source, String tags) {
        // Check if already exists
        Optional<Prospect> existing = prospectRepository.findByEmail(email);
        if (existing.isPresent()) {
            return existing.get();
        }

        Prospect prospect = new Prospect();
        prospect.setEmail(email);
        prospect.setCompanyName(companyName);
        prospect.setDomain(domain);
        prospect.setContactName(contactName);
        prospect.setSource(source != null ? source : "manual");
        prospect.setTags(tags);
        prospect.setStatus("new");
        prospect.setSequenceStep(0);
        prospect.setNextEmailAt(LocalDateTime.now()); // Ready to send immediately
        return prospectRepository.save(prospect);
    }

    /**
     * Bulk import prospects.
     */
    @Transactional
    public Map<String, Object> importProspects(List<Map<String, String>> prospects, String source) {
        int added = 0;
        int skipped = 0;

        for (Map<String, String> p : prospects) {
            String email = p.get("email");
            if (email == null || email.isBlank()) {
                skipped++;
                continue;
            }

            if (prospectRepository.findByEmail(email).isPresent()) {
                skipped++;
                continue;
            }

            addProspect(email,
                    p.getOrDefault("companyName", null),
                    p.getOrDefault("domain", null),
                    p.getOrDefault("contactName", null),
                    source,
                    p.getOrDefault("tags", null));
            added++;
        }

        return Map.of("added", added, "skipped", skipped, "total", prospects.size());
    }

    /**
     * Force-send the next email to a specific prospect (for testing).
     */
    @Transactional
    public Map<String, Object> sendNow(String prospectId) throws Exception {
        Prospect prospect = prospectRepository.findById(prospectId)
                .orElseThrow(() -> new RuntimeException("Prospect not found"));

        boolean sent = sendNextSequenceEmail(prospect);
        return Map.of("prospectId", prospectId, "email", prospect.getEmail(),
                "sent", sent, "newStep", prospect.getSequenceStep());
    }

    /**
     * Get outreach statistics.
     */
    public Map<String, Object> getStats() {
        Map<String, Object> stats = new LinkedHashMap<>();

        stats.put("totalProspects", prospectRepository.count());
        stats.put("newProspects", prospectRepository.countByStatus("new"));
        stats.put("contacted", prospectRepository.countByStatus("contacted"));
        stats.put("engaged", prospectRepository.countByStatus("engaged"));
        stats.put("converted", prospectRepository.countByStatus("converted"));
        stats.put("unsubscribed", prospectRepository.countByStatus("unsubscribed"));
        stats.put("bounced", prospectRepository.countByStatus("bounced"));

        // Source breakdown
        Map<String, Long> bySrc = new LinkedHashMap<>();
        bySrc.put("manual", prospectRepository.countBySource("manual"));
        bySrc.put("scrape", prospectRepository.countBySource("scrape"));
        bySrc.put("referral", prospectRepository.countBySource("referral"));
        bySrc.put("inbound", prospectRepository.countBySource("inbound"));
        stats.put("bySource", bySrc);

        // Recent metrics
        LocalDate weekAgo = LocalDate.now().minusDays(7);
        List<OutreachMetric> recentMetrics = metricRepository
                .findByMetricDateBetweenOrderByMetricDateAsc(weekAgo, LocalDate.now());
        stats.put("weeklyMetrics", recentMetrics);

        // Top prospects by engagement
        List<Prospect> topProspects = prospectRepository.findByScoreGreaterThanOrderByScoreDesc(0);
        stats.put("topEngagedProspects", topProspects.stream().limit(10).toList());

        return stats;
    }

    /**
     * Mark prospect as unsubscribed.
     */
    @Transactional
    public void unsubscribe(String email) {
        prospectRepository.findByEmail(email).ifPresent(prospect -> {
            prospect.setStatus("unsubscribed");
            prospect.setNextEmailAt(null);
            prospectRepository.save(prospect);
            log.info("OUTREACH BOT: Unsubscribed {}", email);
        });
    }

    /**
     * Record open event (called via tracking pixel or webhook).
     */
    @Transactional
    public void recordOpen(String prospectId) {
        prospectRepository.findById(prospectId).ifPresent(prospect -> {
            prospect.setOpens(prospect.getOpens() + 1);
            prospect.setScore(calculateEngagementScore(prospect));
            if ("contacted".equals(prospect.getStatus())) {
                prospect.setStatus("engaged");
            }
            prospectRepository.save(prospect);
        });
    }

    /**
     * Record click event.
     */
    @Transactional
    public void recordClick(String prospectId) {
        prospectRepository.findById(prospectId).ifPresent(prospect -> {
            prospect.setClicks(prospect.getClicks() + 1);
            prospect.setScore(calculateEngagementScore(prospect));
            if (!"converted".equals(prospect.getStatus())) {
                prospect.setStatus("engaged");
            }
            prospectRepository.save(prospect);
        });
    }

    /**
     * Mark as converted (they signed up via /landing).
     */
    @Transactional
    public void markConverted(String email, String companyId) {
        prospectRepository.findByEmail(email).ifPresent(prospect -> {
            prospect.setStatus("converted");
            prospect.setConvertedCompanyId(companyId);
            prospect.setNextEmailAt(null);
            prospect.setScore(100);
            prospectRepository.save(prospect);
            log.info("OUTREACH BOT: CONVERSION! {} signed up as company {}", email, companyId);
        });
    }

    // ─── INTERNAL ─────────────────────────────────────────────────────────

    private double calculateEngagementScore(Prospect prospect) {
        double score = 0;
        score += prospect.getOpens() * 10;   // Each open = 10 points
        score += prospect.getClicks() * 25;  // Each click = 25 points
        score += prospect.getReplies() * 40; // Each reply = 40 points
        return Math.min(100, score);
    }
}
