package com.blackwolf.backend.service;

import com.blackwolf.backend.model.*;
import com.blackwolf.backend.repository.*;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
@Slf4j
public class VulnScanService {

    @Autowired
    private VulnScanRepository vulnScanRepository;

    @Autowired
    private VulnFindingRepository vulnFindingRepository;

    public List<VulnScan> getScans(String companyId) {
        log.debug("Fetching vulnerability scans for company {}", companyId);
        return vulnScanRepository.findByCompanyIdOrderByStartedAtDesc(companyId);
    }

    public VulnScan createScan(String companyId, VulnScan scan) {
        log.info("Creating vulnerability scan for company {}", companyId);
        scan.setCompanyId(companyId);
        scan.setStatus("pending");
        scan.setStartedAt(LocalDateTime.now());
        scan.setCriticalCount(0);
        scan.setHighCount(0);
        scan.setFindingsCount(0);
        return vulnScanRepository.save(scan);
    }

    public List<VulnFinding> getScanFindings(Long scanId) {
        log.debug("Fetching findings for scan {}", scanId);
        return vulnFindingRepository.findByScanIdOrderByCvssScoreDesc(scanId);
    }

    @Transactional
    public VulnFinding addFinding(Long scanId, VulnFinding finding) {
        log.info("Adding finding to scan {}: {}", scanId, finding.getTitle());
        finding.setScanId(scanId);
        finding.setFoundAt(LocalDateTime.now());
        if (finding.getStatus() == null) {
            finding.setStatus("open");
        }
        VulnFinding saved = vulnFindingRepository.save(finding);

        // Increment scan severity counts
        vulnScanRepository.findById(scanId).ifPresent(scan -> {
            String severity = finding.getSeverity() != null ? finding.getSeverity().toLowerCase() : "";
            if ("critical".equals(severity)) {
                scan.setCriticalCount((scan.getCriticalCount() != null ? scan.getCriticalCount() : 0) + 1);
            } else if ("high".equals(severity)) {
                scan.setHighCount((scan.getHighCount() != null ? scan.getHighCount() : 0) + 1);
            }
            scan.setFindingsCount((scan.getFindingsCount() != null ? scan.getFindingsCount() : 0) + 1);
            vulnScanRepository.save(scan);
        });

        return saved;
    }

    @Transactional
    public VulnScan completeScan(Long scanId) {
        log.info("Completing scan {}", scanId);
        VulnScan scan = vulnScanRepository.findById(scanId)
                .orElseThrow(() -> new RuntimeException("Scan not found: " + scanId));

        scan.setStatus("completed");
        scan.setCompletedAt(LocalDateTime.now());

        // Recalculate counts from findings
        List<VulnFinding> findings = vulnFindingRepository.findByScanIdOrderByCvssScoreDesc(scanId);
        long critical = findings.stream().filter(f -> "critical".equalsIgnoreCase(f.getSeverity())).count();
        long high = findings.stream().filter(f -> "high".equalsIgnoreCase(f.getSeverity())).count();

        scan.setCriticalCount((int) critical);
        scan.setHighCount((int) high);
        scan.setFindingsCount(findings.size());

        return vulnScanRepository.save(scan);
    }

    @Transactional
    public VulnFinding updateFindingStatus(Long findingId, String status) {
        log.info("Updating finding {} status to {}", findingId, status);
        VulnFinding finding = vulnFindingRepository.findById(findingId)
                .orElseThrow(() -> new RuntimeException("Finding not found: " + findingId));

        if (!List.of("open", "resolved", "accepted").contains(status)) {
            throw new IllegalArgumentException("Invalid status: " + status + ". Must be one of: open, resolved, accepted");
        }

        finding.setStatus(status);
        return vulnFindingRepository.save(finding);
    }

    public Map<String, Object> getStats(String companyId) {
        log.debug("Getting vulnerability scan stats for company {}", companyId);

        List<VulnScan> scans = vulnScanRepository.findByCompanyIdOrderByStartedAtDesc(companyId);
        long totalScans = scans.size();

        // Gather all findings for all scans of this company
        List<Long> scanIds = scans.stream().map(VulnScan::getId).collect(Collectors.toList());
        List<VulnFinding> allFindings = scanIds.stream()
                .flatMap(sid -> vulnFindingRepository.findByScanIdOrderByCvssScoreDesc(sid).stream())
                .collect(Collectors.toList());

        List<VulnFinding> openFindings = allFindings.stream()
                .filter(f -> "open".equalsIgnoreCase(f.getStatus()))
                .collect(Collectors.toList());

        long openCritical = openFindings.stream().filter(f -> "critical".equalsIgnoreCase(f.getSeverity())).count();
        long openHigh = openFindings.stream().filter(f -> "high".equalsIgnoreCase(f.getSeverity())).count();
        long openMedium = openFindings.stream().filter(f -> "medium".equalsIgnoreCase(f.getSeverity())).count();
        long openLow = openFindings.stream().filter(f -> "low".equalsIgnoreCase(f.getSeverity())).count();

        Map<String, Object> stats = new LinkedHashMap<>();
        stats.put("totalScans", totalScans);
        stats.put("openFindingsBySeverity", Map.of(
                "critical", openCritical,
                "high", openHigh,
                "medium", openMedium,
                "low", openLow
        ));
        stats.put("totalOpenFindings", (long) openFindings.size());
        stats.put("totalFindings", (long) allFindings.size());
        return stats;
    }
}
