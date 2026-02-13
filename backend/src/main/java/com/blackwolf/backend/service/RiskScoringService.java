package com.blackwolf.backend.service;

import com.blackwolf.backend.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;

@Service
public class RiskScoringService {

    @Autowired
    private ThreatEventRepository threatEventRepository;

    @Autowired
    private VulnerabilityRepository vulnerabilityRepository;

    @Autowired
    private IncidentRepository incidentRepository;

    @Autowired
    private SecurityCertificationRepository certificationRepository;

    @Autowired
    private SecurityAuditRepository auditRepository;

    public Map<String, Object> calculateRiskScore(String companyId) {
        // Factors (each contributes to a 0-100 risk score, higher = more risk)
        double score = 0;
        Map<String, Object> breakdown = new LinkedHashMap<>();

        // 1. Open Vulnerabilities (weight: 30%)
        long openVulns = vulnerabilityRepository.countByCompanyIdAndStatus(companyId, "DETECTED")
                + vulnerabilityRepository.countByCompanyIdAndStatus(companyId, "CONFIRMED")
                + vulnerabilityRepository.countByCompanyIdAndStatus(companyId, "IN_REMEDIATION");
        long criticalVulns = vulnerabilityRepository.findByCompanyIdAndRiskLevel(companyId, "CRITICAL").size();
        long highVulns = vulnerabilityRepository.findByCompanyIdAndRiskLevel(companyId, "HIGH").size();

        double vulnScore = Math.min(100, (criticalVulns * 20) + (highVulns * 10) + (openVulns * 3));
        breakdown.put("vulnerabilities", Map.of(
                "score", Math.round(vulnScore),
                "weight", 30,
                "openCount", openVulns,
                "criticalCount", criticalVulns,
                "highCount", highVulns
        ));
        score += vulnScore * 0.30;

        // 2. Recent Threats (weight: 25%)
        long threats7d = threatEventRepository.countByCompanyIdAndTimestampAfter(
                companyId, LocalDateTime.now().minusDays(7));
        long threats24h = threatEventRepository.countByCompanyIdAndTimestampAfter(
                companyId, LocalDateTime.now().minusHours(24));

        double threatScore = Math.min(100, (threats24h * 5) + (threats7d * 1));
        breakdown.put("threats", Map.of(
                "score", Math.round(threatScore),
                "weight", 25,
                "last24h", threats24h,
                "last7d", threats7d
        ));
        score += threatScore * 0.25;

        // 3. Open Incidents (weight: 20%)
        long openIncidents = incidentRepository.countByCompanyIdAndStatus(companyId, "open")
                + incidentRepository.countByCompanyIdAndStatus(companyId, "assigned")
                + incidentRepository.countByCompanyIdAndStatus(companyId, "investigating");
        long criticalIncidents = incidentRepository.findByCompanyIdAndStatus(companyId, "open").stream()
                .filter(i -> "critical".equals(i.getSeverity()))
                .count();

        double incidentScore = Math.min(100, (criticalIncidents * 30) + (openIncidents * 10));
        breakdown.put("incidents", Map.of(
                "score", Math.round(incidentScore),
                "weight", 20,
                "openCount", openIncidents,
                "criticalCount", criticalIncidents
        ));
        score += incidentScore * 0.20;

        // 4. Compliance & Certifications (weight: 15%)
        long activeCerts = certificationRepository.countByCompanyIdAndExpiresAtAfter(
                companyId, LocalDateTime.now());
        // More certifications = lower risk
        double complianceScore = activeCerts >= 3 ? 0 : activeCerts >= 2 ? 20 : activeCerts >= 1 ? 50 : 80;
        breakdown.put("compliance", Map.of(
                "score", Math.round(complianceScore),
                "weight", 15,
                "activeCertifications", activeCerts
        ));
        score += complianceScore * 0.15;

        // 5. Audit Coverage (weight: 10%)
        long totalAudits = auditRepository.findByCompanyId(companyId).size();
        long deliveredAudits = auditRepository.findByCompanyIdAndStatus(companyId, "DELIVERED").size();
        double auditScore = totalAudits == 0 ? 70 : Math.max(0, 100 - (deliveredAudits * 100.0 / Math.max(1, totalAudits)));
        breakdown.put("audits", Map.of(
                "score", Math.round(auditScore),
                "weight", 10,
                "totalAudits", totalAudits,
                "completedAudits", deliveredAudits
        ));
        score += auditScore * 0.10;

        // Final score
        long finalScore = Math.round(Math.min(100, Math.max(0, score)));

        String riskLevel;
        if (finalScore >= 75) riskLevel = "CRITICAL";
        else if (finalScore >= 50) riskLevel = "HIGH";
        else if (finalScore >= 25) riskLevel = "MEDIUM";
        else riskLevel = "LOW";

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("score", finalScore);
        result.put("maxScore", 100);
        result.put("riskLevel", riskLevel);
        result.put("breakdown", breakdown);
        result.put("calculatedAt", LocalDateTime.now().toString());

        return result;
    }
}
