package com.blackwolf.backend.service;

import com.blackwolf.backend.model.*;
import com.blackwolf.backend.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class SocContextService {

    @Autowired
    private ThreatEventRepository threatEventRepository;

    @Autowired
    private IncidentRepository incidentRepository;

    @Autowired
    private SensorRepository sensorRepository;

    @Autowired
    private VulnerabilityRepository vulnerabilityRepository;

    @Autowired
    private SecurityAuditRepository securityAuditRepository;

    @Autowired
    private PenetrationTestRepository penetrationTestRepository;

    @Autowired
    private BlockedIPRepository blockedIPRepository;

    @Autowired
    private CompanyRepository companyRepository;

    public String buildContext(String companyId) {
        StringBuilder ctx = new StringBuilder();

        // Company info
        companyRepository.findById(companyId).ifPresent(c -> {
            ctx.append("=== COMPANY ===\n");
            ctx.append("Name: ").append(c.getCompanyName()).append("\n");
            ctx.append("Domain: ").append(c.getDomain()).append("\n");
            ctx.append("Plan: ").append(c.getPlan()).append("\n\n");
        });

        // Sensors
        List<Sensor> sensors = sensorRepository.findByCompanyId(companyId);
        ctx.append("=== SENSORS (").append(sensors.size()).append(") ===\n");
        for (Sensor s : sensors) {
            ctx.append("- ").append(s.getName())
               .append(" | Status: ").append(s.getStatus())
               .append(" | Last seen: ").append(s.getLastSeen())
               .append(" | Threats detected: ").append(s.getThreatsDetected())
               .append("\n");
        }
        ctx.append("\n");

        // Recent threats (last 20)
        List<ThreatEvent> threats = threatEventRepository.findByCompanyId(companyId);
        ctx.append("=== THREAT EVENTS (total: ").append(threats.size()).append(") ===\n");
        List<ThreatEvent> recentThreats = threats.stream()
                .sorted((a, b) -> b.getTimestamp().compareTo(a.getTimestamp()))
                .limit(20)
                .collect(Collectors.toList());
        for (ThreatEvent t : recentThreats) {
            ctx.append("- [Sev ").append(t.getSeverity()).append("] ")
               .append(t.getThreatType())
               .append(" | Src: ").append(t.getSrcIp())
               .append(" → Dst: ").append(t.getDstIp()).append(":").append(t.getDstPort())
               .append(" | Status: ").append(t.getStatus())
               .append(" | ").append(t.getTimestamp())
               .append(" | ").append(t.getDescription())
               .append("\n");
        }
        ctx.append("\n");

        // Incidents
        List<Incident> incidents = incidentRepository.findByCompanyId(companyId);
        long openIncidents = incidents.stream()
                .filter(i -> !"RESOLVED".equalsIgnoreCase(i.getStatus()) && !"CLOSED".equalsIgnoreCase(i.getStatus()))
                .count();
        ctx.append("=== INCIDENTS (total: ").append(incidents.size()).append(", open: ").append(openIncidents).append(") ===\n");
        for (Incident i : incidents) {
            ctx.append("- [").append(i.getSeverity()).append("] ")
               .append(i.getTitle())
               .append(" | Status: ").append(i.getStatus())
               .append(" | Assigned: ").append(i.getAssignedTo() != null ? i.getAssignedTo() : "unassigned")
               .append(" | SLA: ").append(i.getSlaDeadline())
               .append(" | Created: ").append(i.getCreatedAt())
               .append("\n");
        }
        ctx.append("\n");

        // Vulnerabilities
        List<Vulnerability> vulns = vulnerabilityRepository.findByCompanyId(companyId);
        long openVulns = vulns.stream()
                .filter(v -> !"FIXED".equalsIgnoreCase(v.getStatus()) && !"VERIFIED".equalsIgnoreCase(v.getStatus()))
                .count();
        ctx.append("=== VULNERABILITIES (total: ").append(vulns.size()).append(", open: ").append(openVulns).append(") ===\n");
        for (Vulnerability v : vulns) {
            ctx.append("- [").append(v.getRiskLevel()).append(" CVSS:").append(v.getCvssScore()).append("] ")
               .append(v.getTitle())
               .append(" | CVE: ").append(v.getCveId() != null ? v.getCveId() : "N/A")
               .append(" | Status: ").append(v.getStatus())
               .append(" | Asset: ").append(v.getAffectedAsset())
               .append("\n");
        }
        ctx.append("\n");

        // Blocked IPs
        List<BlockedIP> blockedIPs = blockedIPRepository.findByCompanyId(companyId);
        ctx.append("=== BLOCKED IPs (").append(blockedIPs.size()).append(") ===\n");
        for (BlockedIP b : blockedIPs) {
            ctx.append("- ").append(b.getIp())
               .append(" | Reason: ").append(b.getReason())
               .append(" | Blocked: ").append(b.getBlockedAt())
               .append("\n");
        }
        ctx.append("\n");

        // Audits
        List<SecurityAudit> audits = securityAuditRepository.findByCompanyId(companyId);
        ctx.append("=== SECURITY AUDITS (").append(audits.size()).append(") ===\n");
        for (SecurityAudit a : audits) {
            ctx.append("- ").append(a.getTitle())
               .append(" | Type: ").append(a.getAuditType())
               .append(" | Status: ").append(a.getStatus())
               .append(" | Lead: ").append(a.getLeadAuditor())
               .append("\n");
        }
        ctx.append("\n");

        // Pentests
        List<PenetrationTest> pentests = penetrationTestRepository.findByCompanyId(companyId);
        ctx.append("=== PENETRATION TESTS (").append(pentests.size()).append(") ===\n");
        for (PenetrationTest p : pentests) {
            ctx.append("- ").append(p.getTitle())
               .append(" | Type: ").append(p.getTestType())
               .append(" | Status: ").append(p.getStatus())
               .append(" | Tester: ").append(p.getTester())
               .append("\n");
        }

        return ctx.toString();
    }
}
