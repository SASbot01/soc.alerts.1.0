package com.blackwolf.backend.service;

import com.blackwolf.backend.dto.IncidentDTOs.*;
import com.blackwolf.backend.model.*;
import com.blackwolf.backend.repository.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Service
public class IncidentService {

    private static final Logger log = LoggerFactory.getLogger(IncidentService.class);

    @Autowired
    private IncidentRepository incidentRepository;

    @Autowired
    private IncidentTimelineRepository timelineRepository;

    @Autowired
    private SseService sseService;

    @Autowired
    private AiDecisionRepository aiDecisionRepository;

    @Autowired
    private ThreatEventRepository threatEventRepository;

    @Autowired
    private BlockedIPRepository blockedIPRepository;

    @Autowired
    private CompanyRepository companyRepository;

    @Autowired
    private BlockedSubnetRepository blockedSubnetRepository;

    @Value("${incident.auto-resolve.enabled:true}")
    private boolean autoResolveEnabled;

    // ===== AUTO-RESOLVE STALE INCIDENTS =====

    @Scheduled(fixedDelayString = "${incident.auto-resolve.interval-ms:600000}")
    @Transactional
    public void autoResolveStale() {
        if (!autoResolveEnabled) return;

        try {
            List<Company> companies = companyRepository.findAll();
            int totalResolved = 0;

            for (Company company : companies) {
                List<Incident> openIncidents = incidentRepository.findByCompanyIdAndStatusIn(
                        company.getId(), List.of("open", "investigating"));

                for (Incident incident : openIncidents) {
                    String reason = checkAutoResolveReason(incident);
                    if (reason != null) {
                        // For high/critical: transition through investigating → contained → resolved
                        String sev = incident.getSeverity() != null ? incident.getSeverity().toLowerCase() : "low";
                        if ("high".equals(sev) || "critical".equals(sev)) {
                            addTimelineEntry(incident.getId(), "Auto-Investigating",
                                    "AI agent automatically investigating: " + reason, "ai-agent");
                            addTimelineEntry(incident.getId(), "Auto-Contained",
                                    "Threat contained — attacker IP blocked, playbooks executed", "ai-agent");
                        }
                        incident.setStatus("resolved");
                        incident.setResolvedAt(LocalDateTime.now());
                        incident.setUpdatedAt(LocalDateTime.now());
                        incidentRepository.save(incident);

                        addTimelineEntry(incident.getId(), "Auto-Resolved", reason, "ai-agent");
                        totalResolved++;
                    }
                }
            }

            if (totalResolved > 0) {
                log.info("Auto-resolve: Resolved {} stale incidents", totalResolved);
            }
        } catch (Exception e) {
            log.error("Auto-resolve: Failed: {}", e.getMessage());
        }
    }

    private String checkAutoResolveReason(Incident incident) {
        // Rule A: Source threat was classified NOISE or FALSE_POSITIVE by AI
        if (incident.getSourceThreatId() != null) {
            List<AiDecision> decisions = aiDecisionRepository.findByThreatEventId(incident.getSourceThreatId());
            for (AiDecision d : decisions) {
                if (d.getVerdict() == AiDecision.Verdict.NOISE || d.getVerdict() == AiDecision.Verdict.FALSE_POSITIVE) {
                    return "Auto-resolved: Source threat classified as " + d.getVerdict() + " by AI agent (confidence: "
                            + d.getConfidence() + ")";
                }
            }
        }

        // Rule B: Associated IP is actively blocked (attacker is contained)
        if (incident.getSourceThreatId() != null) {
            var threatOpt = threatEventRepository.findById(incident.getSourceThreatId());
            if (threatOpt.isPresent() && threatOpt.get().getSrcIp() != null) {
                String srcIp = threatOpt.get().getSrcIp();
                BlockedIPId ipId = new BlockedIPId();
                ipId.setIp(srcIp);
                ipId.setCompanyId(incident.getCompanyId());
                var blockedOpt = blockedIPRepository.findById(ipId);
                if (blockedOpt.isPresent() && blockedOpt.get().getExpiresAt() != null
                        && blockedOpt.get().getExpiresAt().isAfter(LocalDateTime.now())) {
                    return "Auto-resolved: Attacker IP " + srcIp + " is actively blocked until " + blockedOpt.get().getExpiresAt() + " — threat contained";
                }
            }
        }

        // Rule C: SLA deadline passed — low auto-resolves, medium after 2x SLA
        if (incident.getSlaDeadline() != null && incident.getSlaDeadline().isBefore(LocalDateTime.now())) {
            String sev = incident.getSeverity() != null ? incident.getSeverity().toLowerCase() : "low";
            if ("low".equals(sev)) {
                return "Auto-resolved: SLA deadline passed (" + incident.getSlaDeadline() + ") without escalation";
            }
            // Medium incidents auto-resolve if 2x SLA has passed and no new activity
            if ("medium".equals(sev) && incident.getSlaDeadline().plusHours(8).isBefore(LocalDateTime.now())) {
                return "Auto-resolved: Medium severity — no activity after extended SLA window";
            }
        }

        // Rule D: HIGH/CRITICAL incidents — auto-resolve if AI analyzed, IP blocked, and block is still active
        if (incident.getSourceThreatId() != null) {
            String sev = incident.getSeverity() != null ? incident.getSeverity().toLowerCase() : "";
            if ("high".equals(sev) || "critical".equals(sev)) {
                List<AiDecision> decisions = aiDecisionRepository.findByThreatEventId(incident.getSourceThreatId());
                for (AiDecision d : decisions) {
                    if (d.getIpBlocked() != null && d.getIpBlocked()
                            && (d.getVerdict() == AiDecision.Verdict.REAL_ATTACK || d.getVerdict() == AiDecision.Verdict.CRITICAL_ATTACK)) {
                        // AI confirmed attack and IP was blocked — auto-contain
                        var threatOpt = threatEventRepository.findById(incident.getSourceThreatId());
                        if (threatOpt.isPresent() && threatOpt.get().getSrcIp() != null) {
                            BlockedIPId ipId = new BlockedIPId();
                            ipId.setIp(threatOpt.get().getSrcIp());
                            ipId.setCompanyId(incident.getCompanyId());
                            var blockedOpt = blockedIPRepository.findById(ipId);
                            if (blockedOpt.isPresent() && blockedOpt.get().getExpiresAt() != null
                                    && blockedOpt.get().getExpiresAt().isAfter(LocalDateTime.now())) {
                                return "Auto-resolved: AI confirmed " + d.getVerdict() + " — IP "
                                        + threatOpt.get().getSrcIp() + " actively blocked until "
                                        + blockedOpt.get().getExpiresAt()
                                        + ". Confidence: " + d.getConfidence();
                            }
                        }
                    }
                }
            }
        }

        // Rule E: Age-based auto-resolve — low >6h, medium >12h regardless of SLA
        if (incident.getCreatedAt() != null) {
            String sev = incident.getSeverity() != null ? incident.getSeverity().toLowerCase() : "low";
            if ("low".equals(sev) && incident.getCreatedAt().plusHours(6).isBefore(LocalDateTime.now())) {
                return "Auto-resolved: Low severity incident aged >6 hours without escalation";
            }
            if ("medium".equals(sev) && incident.getCreatedAt().plusHours(12).isBefore(LocalDateTime.now())) {
                return "Auto-resolved: Medium severity incident aged >12 hours without escalation";
            }
        }

        // Rule F: Subnet-based — auto-resolve if source IP falls in a blocked subnet
        if (incident.getSourceThreatId() != null) {
            var threatOpt = threatEventRepository.findById(incident.getSourceThreatId());
            if (threatOpt.isPresent() && threatOpt.get().getSrcIp() != null) {
                String srcIp = threatOpt.get().getSrcIp();
                String subnet = extractSubnet24(srcIp);
                if (subnet != null) {
                    List<BlockedSubnet> activeSubnets = blockedSubnetRepository.findActiveByCompanyId(
                            incident.getCompanyId(), LocalDateTime.now());
                    for (BlockedSubnet bs : activeSubnets) {
                        if (bs.getCidr().equals(subnet)) {
                            return "Auto-resolved: Source IP " + srcIp + " belongs to blocked subnet " + subnet
                                    + " (blocked by " + bs.getBlockedBy() + ": " + bs.getReason() + ")";
                        }
                    }
                }
            }
        }

        return null;
    }

    private static String extractSubnet24(String ip) {
        if (ip == null || !ip.contains(".")) return null;
        String[] parts = ip.split("\\.");
        if (parts.length != 4) return null;
        return parts[0] + "." + parts[1] + "." + parts[2] + ".0/24";
    }

    public List<Incident> listByCompany(String companyId) {
        return incidentRepository.findByCompanyId(companyId);
    }

    @Transactional
    public Incident createIncident(String companyId, CreateIncidentRequest request) {
        Incident incident = new Incident();
        incident.setId(UUID.randomUUID().toString());
        incident.setCompanyId(companyId);
        incident.setTitle(request.getTitle());
        incident.setDescription(request.getDescription());
        incident.setSeverity(request.getSeverity());
        incident.setStatus("open");
        incident.setAssignedTo(request.getAssignedTo());
        incident.setSourceThreatId(request.getSourceThreatId());
        incident.setCreatedAt(LocalDateTime.now());
        incident.setUpdatedAt(LocalDateTime.now());

        // SLA: critical=2h, high=4h, medium=8h, low=24h
        int slaHours = switch (request.getSeverity()) {
            case "critical" -> 2;
            case "high" -> 4;
            case "medium" -> 8;
            default -> 24;
        };
        incident.setSlaDeadline(LocalDateTime.now().plusHours(slaHours));

        incident = incidentRepository.save(incident);

        addTimelineEntry(incident.getId(), "Incident Created",
                "Incident opened with severity " + request.getSeverity(), "system");

        // Emit SSE event
        sseService.emitIncident(incident);

        return incident;
    }

    @Transactional
    public Incident updateIncident(String id, String companyId, UpdateIncidentRequest request) {
        Incident incident = incidentRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Incident not found"));
        if (!companyId.equals(incident.getCompanyId())) {
            throw new RuntimeException("Access denied");
        }

        String oldStatus = incident.getStatus();

        if (request.getStatus() != null) {
            incident.setStatus(request.getStatus());
            if ("resolved".equals(request.getStatus()) || "closed".equals(request.getStatus())) {
                incident.setResolvedAt(LocalDateTime.now());
            }
        }
        if (request.getAssignedTo() != null) {
            incident.setAssignedTo(request.getAssignedTo());
        }
        if (request.getDescription() != null) {
            incident.setDescription(request.getDescription());
        }
        incident.setUpdatedAt(LocalDateTime.now());
        incident = incidentRepository.save(incident);

        if (request.getStatus() != null && !request.getStatus().equals(oldStatus)) {
            addTimelineEntry(id, "Status Changed",
                    "Status changed from " + oldStatus + " to " + request.getStatus(), "user");
        }

        return incident;
    }

    public IncidentDetailResponse getDetail(String id, String companyId) {
        Incident incident = incidentRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Incident not found"));
        if (!companyId.equals(incident.getCompanyId())) {
            throw new RuntimeException("Access denied");
        }

        List<IncidentTimeline> timeline = timelineRepository.findByIncidentIdOrderByCreatedAtDesc(id);

        IncidentDetailResponse response = new IncidentDetailResponse();
        response.setIncident(incident);
        response.setTimeline(timeline);
        return response;
    }

    @Transactional
    public IncidentTimeline addTimeline(String incidentId, String companyId, AddTimelineRequest request, String performedBy) {
        Incident incident = incidentRepository.findById(incidentId)
                .orElseThrow(() -> new RuntimeException("Incident not found"));
        if (!companyId.equals(incident.getCompanyId())) {
            throw new RuntimeException("Access denied");
        }
        return addTimelineEntry(incidentId, request.getAction(), request.getDescription(), performedBy);
    }

    public IncidentTimeline addTimelineEntry(String incidentId, String action, String description, String performedBy) {
        IncidentTimeline entry = new IncidentTimeline();
        entry.setId(UUID.randomUUID().toString());
        entry.setIncidentId(incidentId);
        entry.setAction(action);
        entry.setDescription(description);
        entry.setPerformedBy(performedBy);
        entry.setCreatedAt(LocalDateTime.now());
        return timelineRepository.save(entry);
    }

    // Called by correlation engine
    public Incident createFromThreat(String companyId, String threatId, String threatType, int severity, String description) {
        CreateIncidentRequest req = new CreateIncidentRequest();
        req.setTitle("Auto-generated: " + threatType + " (severity " + severity + ")");
        req.setDescription(description);
        String sevLabel = severity >= 9 ? "critical" : severity >= 7 ? "high" : severity >= 4 ? "medium" : "low";
        req.setSeverity(sevLabel);
        req.setSourceThreatId(threatId);
        // Auto-triage: assign to AI agent queue by severity so all incidents have an owner
        req.setAssignedTo("ai-agent-" + sevLabel);
        return createIncident(companyId, req);
    }
}
