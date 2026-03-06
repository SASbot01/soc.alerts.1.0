package com.blackwolf.backend.service;

import com.blackwolf.backend.dto.InfrastructureDTOs.*;
import com.blackwolf.backend.model.BackupStatus;
import com.blackwolf.backend.repository.BackupStatusRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class BackupMonitorService {

    @Autowired
    private BackupStatusRepository backupStatusRepository;

    @Autowired
    private ApiKeyService apiKeyService;

    @Autowired
    private AlertService alertService;

    @Autowired
    private SseService sseService;

    public BackupStatus reportBackup(BackupReportRequest request) {
        Optional<String> validatedCompanyId = apiKeyService.validateKey(request.getApi_key());
        if (validatedCompanyId.isEmpty() || !validatedCompanyId.get().equals(request.getCompany_id())) {
            throw new RuntimeException("Invalid API key or company mismatch");
        }

        BackupStatus status = new BackupStatus();
        status.setId(UUID.randomUUID().toString());
        status.setCompanyId(request.getCompany_id());
        status.setClientHost(request.getClient_host());
        status.setJobName(request.getJob_name());
        status.setStatus(request.getStatus().toUpperCase());
        status.setBackupType(request.getBackup_type() != null ? request.getBackup_type() : "full");
        status.setTarget(request.getTarget());
        status.setSizeBytes(request.getSize_bytes() != null ? request.getSize_bytes() : 0L);
        status.setDurationSeconds(request.getDuration_seconds() != null ? request.getDuration_seconds() : 0);
        status.setErrorMessage(request.getError_message());
        status.setReportedAt(LocalDateTime.now());

        if (request.getStarted_at() != null) {
            try {
                status.setStartedAt(LocalDateTime.parse(request.getStarted_at(), DateTimeFormatter.ISO_DATE_TIME));
            } catch (Exception ignored) {}
        }
        if (request.getFinished_at() != null) {
            try {
                status.setFinishedAt(LocalDateTime.parse(request.getFinished_at(), DateTimeFormatter.ISO_DATE_TIME));
            } catch (Exception ignored) {}
        }

        backupStatusRepository.save(status);

        // Alert on failure
        if ("FAILED".equals(status.getStatus())) {
            try {
                alertService.sendBackupFailureAlert(status);
            } catch (Exception ignored) {}
        }

        return status;
    }

    public BackupDashboard getDashboard(String companyId) {
        LocalDateTime since = LocalDateTime.now().minusDays(7);
        List<BackupStatus> recent = backupStatusRepository.findRecentByCompanyId(companyId, since);

        BackupDashboard dashboard = new BackupDashboard();
        dashboard.setTotalJobs(recent.size());
        dashboard.setSuccessCount(recent.stream().filter(b -> "SUCCESS".equals(b.getStatus())).count());
        dashboard.setFailedCount(recent.stream().filter(b -> "FAILED".equals(b.getStatus())).count());
        dashboard.setStaleCount(recent.stream().filter(b -> "STALE".equals(b.getStatus())).count());
        dashboard.setTotalSizeBytes(recent.stream().mapToLong(b -> b.getSizeBytes() != null ? b.getSizeBytes() : 0).sum());

        dashboard.setJobs(recent.stream().limit(50).map(b -> {
            BackupJobSummary s = new BackupJobSummary();
            s.setId(b.getId());
            s.setClientHost(b.getClientHost());
            s.setJobName(b.getJobName());
            s.setStatus(b.getStatus());
            s.setBackupType(b.getBackupType());
            s.setTarget(b.getTarget());
            s.setSizeBytes(b.getSizeBytes());
            s.setDurationSeconds(b.getDurationSeconds());
            s.setErrorMessage(b.getErrorMessage());
            s.setStartedAt(b.getStartedAt());
            s.setFinishedAt(b.getFinishedAt());
            s.setReportedAt(b.getReportedAt());
            return s;
        }).collect(Collectors.toList()));

        // Group by host
        Map<String, List<BackupStatus>> byHost = recent.stream()
                .collect(Collectors.groupingBy(BackupStatus::getClientHost));
        dashboard.setHosts(byHost.entrySet().stream().map(entry -> {
            BackupHostSummary h = new BackupHostSummary();
            h.setHost(entry.getKey());
            h.setTotalJobs(entry.getValue().size());
            h.setSuccessJobs(entry.getValue().stream().filter(b -> "SUCCESS".equals(b.getStatus())).count());
            h.setFailedJobs(entry.getValue().stream().filter(b -> "FAILED".equals(b.getStatus())).count());
            h.setLastBackup(entry.getValue().stream()
                    .map(BackupStatus::getReportedAt)
                    .max(LocalDateTime::compareTo)
                    .orElse(null));
            return h;
        }).collect(Collectors.toList()));

        return dashboard;
    }

    public List<BackupStatus> getHistory(String companyId) {
        return backupStatusRepository.findByCompanyIdOrderByReportedAtDesc(companyId);
    }

    // Mark backups as stale if no report for 25 hours
    @Scheduled(fixedRate = 3600000) // every hour
    public void detectStaleBackups() {
        LocalDateTime staleThreshold = LocalDateTime.now().minusHours(25);
        // This runs globally — for each company, check if their latest backup per host/job is older than threshold
        List<BackupStatus> all = backupStatusRepository.findAll();
        Map<String, BackupStatus> latestByKey = new HashMap<>();

        for (BackupStatus b : all) {
            String key = b.getCompanyId() + "|" + b.getClientHost() + "|" + b.getJobName();
            BackupStatus existing = latestByKey.get(key);
            if (existing == null || b.getReportedAt().isAfter(existing.getReportedAt())) {
                latestByKey.put(key, b);
            }
        }

        for (BackupStatus latest : latestByKey.values()) {
            if (latest.getReportedAt().isBefore(staleThreshold) && !"STALE".equals(latest.getStatus())) {
                BackupStatus stale = new BackupStatus();
                stale.setId(UUID.randomUUID().toString());
                stale.setCompanyId(latest.getCompanyId());
                stale.setClientHost(latest.getClientHost());
                stale.setJobName(latest.getJobName());
                stale.setStatus("STALE");
                stale.setBackupType(latest.getBackupType());
                stale.setTarget(latest.getTarget());
                stale.setSizeBytes(0L);
                stale.setDurationSeconds(0);
                stale.setErrorMessage("No backup report received in 25+ hours. Last: " + latest.getReportedAt());
                stale.setReportedAt(LocalDateTime.now());
                backupStatusRepository.save(stale);

                try {
                    alertService.sendBackupFailureAlert(stale);
                } catch (Exception ignored) {}
            }
        }
    }
}
