package com.blackwolf.backend.service;

import com.blackwolf.backend.model.Company;
import com.blackwolf.backend.model.DataRetentionLog;
import com.blackwolf.backend.repository.CompanyRepository;
import com.blackwolf.backend.repository.DataRetentionLogRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Service
public class DataRetentionService {

    private static final Logger log = LoggerFactory.getLogger(DataRetentionService.class);

    @Autowired
    private CompanyRepository companyRepository;

    @Autowired
    private DataRetentionLogRepository retentionLogRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    /**
     * Daily job at 3 AM — purge old data per company's retention policy.
     */
    @Scheduled(cron = "0 0 3 * * *")
    public void runRetention() {
        log.info("Starting daily data retention job");
        List<Company> companies = companyRepository.findAll();

        for (Company company : companies) {
            int retentionDays = company.getRetentionDays() != null ? company.getRetentionDays() : 30;
            try {
                purgeCompanyData(company.getId(), retentionDays);
            } catch (Exception e) {
                log.error("Retention failed for company {}: {}", company.getId(), e.getMessage());
                logRetention(company.getId(), retentionDays, 0, 0, 0, "failed", e.getMessage());
            }
        }
        log.info("Data retention job completed");
    }

    @Transactional
    public void purgeCompanyData(String companyId, int retentionDays) {
        LocalDateTime cutoff = LocalDateTime.now().minusDays(retentionDays);
        log.info("Purging data older than {} for company {} ({}d retention)", cutoff, companyId, retentionDays);

        int threats = jdbcTemplate.update(
                "DELETE FROM threat_events WHERE company_id = ? AND timestamp < ?",
                companyId, cutoff);

        int alerts = jdbcTemplate.update(
                "DELETE FROM alert_history WHERE company_id = ? AND sent_at < ?",
                companyId, cutoff);

        int activityLogs = jdbcTemplate.update(
                "DELETE FROM activity_logs WHERE company_id = ? AND performed_at < ?",
                companyId, cutoff);

        log.info("Company {} retention: {}d purged {} threats, {} alerts, {} activity logs",
                companyId, retentionDays, threats, alerts, activityLogs);

        logRetention(companyId, retentionDays, threats, alerts, activityLogs, "completed", null);
    }

    private void logRetention(String companyId, int retentionDays, int threats, int alerts,
                               int activityLogs, String status, String error) {
        DataRetentionLog retentionLog = new DataRetentionLog();
        retentionLog.setId(UUID.randomUUID().toString());
        retentionLog.setCompanyId(companyId);
        retentionLog.setRunAt(LocalDateTime.now());
        retentionLog.setRetentionDays(retentionDays);
        retentionLog.setThreatsDeleted(threats);
        retentionLog.setAlertsDeleted(alerts);
        retentionLog.setActivityLogsDeleted(activityLogs);
        retentionLog.setStatus(status);
        retentionLog.setErrorMessage(error);
        retentionLogRepository.save(retentionLog);
    }

    /**
     * Get retention logs for a company.
     */
    public List<DataRetentionLog> getRetentionLogs(String companyId) {
        return retentionLogRepository.findByCompanyIdOrderByRunAtDesc(companyId);
    }
}
