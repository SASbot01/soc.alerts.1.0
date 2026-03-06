package com.blackwolf.backend.service;

import com.blackwolf.backend.dto.InfrastructureDTOs.*;
import com.blackwolf.backend.model.HealthCheckResult;
import com.blackwolf.backend.model.HealthCheckTarget;
import com.blackwolf.backend.repository.HealthCheckResultRepository;
import com.blackwolf.backend.repository.HealthCheckTargetRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.net.HttpURLConnection;
import java.net.InetAddress;
import java.net.Socket;
import java.net.URL;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class HealthCheckService {

    private static final Logger log = LoggerFactory.getLogger(HealthCheckService.class);

    @Autowired
    private HealthCheckTargetRepository targetRepository;

    @Autowired
    private HealthCheckResultRepository resultRepository;

    @Autowired
    private AlertService alertService;

    public HealthCheckTarget createTarget(String companyId, CreateHealthCheckRequest request) {
        HealthCheckTarget target = new HealthCheckTarget();
        target.setId(UUID.randomUUID().toString());
        target.setCompanyId(companyId);
        target.setName(request.getName());
        target.setCheckType(request.getCheckType().toUpperCase());
        target.setTarget(request.getTarget());
        target.setPort(request.getPort());
        target.setExpectedStatus(request.getExpectedStatus() != null ? request.getExpectedStatus() : 200);
        target.setTimeoutMs(request.getTimeoutMs() != null ? request.getTimeoutMs() : 5000);
        target.setIntervalSeconds(request.getIntervalSeconds() != null ? request.getIntervalSeconds() : 300);
        target.setEnabled(true);
        target.setCreatedAt(LocalDateTime.now());
        return targetRepository.save(target);
    }

    public List<HealthCheckTarget> listTargets(String companyId) {
        return targetRepository.findByCompanyIdOrderByCreatedAtDesc(companyId);
    }

    public void deleteTarget(String id, String companyId) {
        HealthCheckTarget target = targetRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Target not found"));
        if (!target.getCompanyId().equals(companyId)) {
            throw new RuntimeException("Access denied");
        }
        targetRepository.delete(target);
    }

    public HealthCheckTarget toggleTarget(String id, String companyId) {
        HealthCheckTarget target = targetRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Target not found"));
        if (!target.getCompanyId().equals(companyId)) {
            throw new RuntimeException("Access denied");
        }
        target.setEnabled(!target.getEnabled());
        return targetRepository.save(target);
    }

    public RunHealthCheckResponse runCheck(String targetId, String companyId) {
        HealthCheckTarget target = targetRepository.findById(targetId)
                .orElseThrow(() -> new RuntimeException("Target not found"));
        if (!target.getCompanyId().equals(companyId)) {
            throw new RuntimeException("Access denied");
        }
        return executeCheck(target);
    }

    public List<RunHealthCheckResponse> runAllChecks(String companyId) {
        List<HealthCheckTarget> targets = targetRepository.findByCompanyIdAndEnabledTrue(companyId);
        return targets.stream().map(this::executeCheck).collect(Collectors.toList());
    }

    public HealthCheckDashboard getDashboard(String companyId) {
        List<HealthCheckTarget> targets = targetRepository.findByCompanyIdOrderByCreatedAtDesc(companyId);
        LocalDateTime since24h = LocalDateTime.now().minusHours(24);

        HealthCheckDashboard dashboard = new HealthCheckDashboard();
        dashboard.setTotalTargets(targets.size());

        List<HealthCheckTargetStatus> statuses = new ArrayList<>();
        long healthy = 0, failing = 0, unknown = 0;

        for (HealthCheckTarget target : targets) {
            HealthCheckTargetStatus s = new HealthCheckTargetStatus();
            s.setId(target.getId());
            s.setName(target.getName());
            s.setCheckType(target.getCheckType());
            s.setTarget(target.getTarget());
            s.setPort(target.getPort());
            s.setEnabled(target.getEnabled());

            Optional<HealthCheckResult> latest = resultRepository.findLatestByTargetId(target.getId());
            if (latest.isPresent()) {
                HealthCheckResult r = latest.get();
                s.setLastStatus(r.getStatus());
                s.setLastResponseTimeMs(r.getResponseTimeMs());
                s.setLastError(r.getErrorMessage());
                s.setLastCheckedAt(r.getCheckedAt());

                if ("OK".equals(r.getStatus())) healthy++;
                else failing++;
            } else {
                s.setLastStatus("UNKNOWN");
                unknown++;
            }

            // Calculate uptime percentage from last 24h results
            List<HealthCheckResult> recentResults = resultRepository.findByTargetIdOrderByCheckedAtDesc(target.getId())
                    .stream().filter(r -> r.getCheckedAt().isAfter(since24h)).collect(Collectors.toList());
            if (!recentResults.isEmpty()) {
                long okCount = recentResults.stream().filter(r -> "OK".equals(r.getStatus())).count();
                s.setUptimePercent(Math.round(okCount * 10000.0 / recentResults.size()) / 100.0);
            } else {
                s.setUptimePercent(0.0);
            }

            statuses.add(s);
        }

        dashboard.setHealthyCount(healthy);
        dashboard.setFailingCount(failing);
        dashboard.setUnknownCount(unknown);
        dashboard.setTargets(statuses);

        return dashboard;
    }

    private RunHealthCheckResponse executeCheck(HealthCheckTarget target) {
        long start = System.currentTimeMillis();
        String status = "OK";
        Integer statusCode = null;
        String errorMessage = null;

        try {
            switch (target.getCheckType()) {
                case "HTTP":
                    statusCode = checkHttp(target);
                    if (target.getExpectedStatus() != null && !target.getExpectedStatus().equals(statusCode)) {
                        status = "FAIL";
                        errorMessage = "Expected status " + target.getExpectedStatus() + " but got " + statusCode;
                    }
                    break;
                case "TCP":
                    checkTcp(target);
                    break;
                case "PING":
                    boolean reachable = checkPing(target);
                    if (!reachable) {
                        status = "FAIL";
                        errorMessage = "Host unreachable";
                    }
                    break;
                case "DNS":
                    checkDns(target);
                    break;
                default:
                    checkTcp(target);
            }
        } catch (Exception e) {
            status = "ERROR";
            errorMessage = e.getMessage();
        }

        int responseTimeMs = (int) (System.currentTimeMillis() - start);

        // Timeout check
        if (responseTimeMs > target.getTimeoutMs()) {
            status = "TIMEOUT";
            errorMessage = "Response time " + responseTimeMs + "ms exceeded timeout " + target.getTimeoutMs() + "ms";
        }

        // Save result
        HealthCheckResult result = new HealthCheckResult();
        result.setId(UUID.randomUUID().toString());
        result.setTargetId(target.getId());
        result.setCompanyId(target.getCompanyId());
        result.setStatus(status);
        result.setResponseTimeMs(responseTimeMs);
        result.setStatusCode(statusCode);
        result.setErrorMessage(errorMessage);
        result.setCheckedAt(LocalDateTime.now());
        resultRepository.save(result);

        RunHealthCheckResponse response = new RunHealthCheckResponse();
        response.setTargetId(target.getId());
        response.setTargetName(target.getName());
        response.setStatus(status);
        response.setResponseTimeMs(responseTimeMs);
        response.setStatusCode(statusCode);
        response.setErrorMessage(errorMessage);
        response.setCheckedAt(result.getCheckedAt());
        return response;
    }

    private int checkHttp(HealthCheckTarget target) throws IOException {
        URL url = new URL(target.getTarget());
        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
        conn.setRequestMethod("GET");
        conn.setConnectTimeout(target.getTimeoutMs());
        conn.setReadTimeout(target.getTimeoutMs());
        conn.setInstanceFollowRedirects(true);
        try {
            return conn.getResponseCode();
        } finally {
            conn.disconnect();
        }
    }

    private void checkTcp(HealthCheckTarget target) throws IOException {
        int port = target.getPort() != null ? target.getPort() : 80;
        try (Socket socket = new Socket()) {
            socket.connect(new java.net.InetSocketAddress(target.getTarget(), port), target.getTimeoutMs());
        }
    }

    private boolean checkPing(HealthCheckTarget target) throws IOException {
        InetAddress address = InetAddress.getByName(target.getTarget());
        return address.isReachable(target.getTimeoutMs());
    }

    private void checkDns(HealthCheckTarget target) throws java.net.UnknownHostException {
        InetAddress.getByName(target.getTarget());
    }

    // Scheduled execution of all enabled health checks
    @Scheduled(fixedRate = 300000) // every 5 minutes
    public void runScheduledChecks() {
        List<HealthCheckTarget> allEnabled = targetRepository.findAll().stream()
                .filter(t -> Boolean.TRUE.equals(t.getEnabled()))
                .collect(Collectors.toList());

        for (HealthCheckTarget target : allEnabled) {
            try {
                Optional<HealthCheckResult> latest = resultRepository.findLatestByTargetId(target.getId());
                // Only run if interval has elapsed since last check
                if (latest.isPresent()) {
                    LocalDateTime nextRun = latest.get().getCheckedAt()
                            .plusSeconds(target.getIntervalSeconds() != null ? target.getIntervalSeconds() : 300);
                    if (LocalDateTime.now().isBefore(nextRun)) continue;
                }

                RunHealthCheckResponse response = executeCheck(target);

                // Alert if check failed and previous was OK (state change)
                if (!"OK".equals(response.getStatus())) {
                    if (latest.isEmpty() || "OK".equals(latest.get().getStatus())) {
                        log.warn("Health check FAILED: {} ({}) - {}", target.getName(), target.getTarget(), response.getErrorMessage());
                    }
                }
            } catch (Exception e) {
                log.error("Error running scheduled health check for {}: {}", target.getName(), e.getMessage());
            }
        }
    }
}
