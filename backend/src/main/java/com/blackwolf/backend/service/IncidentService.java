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
                List<Incident> openIncidents = incidentRepository.findByCompanyIdAndStatus(company.getId(), "open");

                for (Incident incident : openIncidents) {
                    String reason = checkAutoResolveReason(incident);
                    if (reason != null) {
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

        // Rule B: Associated blocked IP has expired
        if (incident.getSourceThreatId() != null) {
            var threatOpt = threatEventRepository.findById(incident.getSourceThreatId());
            if (threatOpt.isPresent() && threatOpt.get().getSrcIp() != null) {
                String srcIp = threatOpt.get().getSrcIp();
                BlockedIPId ipId = new BlockedIPId();
                ipId.setIp(srcIp);
                ipId.setCompanyId(incident.getCompanyId());
                var blockedOpt = blockedIPRepository.findById(ipId);
                if (blockedOpt.isPresent() && blockedOpt.get().getExpiresAt() != null
                        && blockedOpt.get().getExpiresAt().isBefore(LocalDateTime.now())) {
                    return "Auto-resolved: Blocked IP " + srcIp + " has expired (expired at " + blockedOpt.get().getExpiresAt() + ")";
                }
            }
        }

        // Rule C: SLA deadline passed without escalation
        if (incident.getSlaDeadline() != null && incident.getSlaDeadline().isBefore(LocalDateTime.now())) {
            return "Auto-resolved: SLA deadline passed (" + incident.getSlaDeadline() + ") without escalation";
        }

        return null;
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
        req.setSeverity(severity >= 9 ? "critical" : severity >= 7 ? "high" : severity >= 4 ? "medium" : "low");
        req.setSourceThreatId(threatId);
        return createIncident(companyId, req);
    }
}
