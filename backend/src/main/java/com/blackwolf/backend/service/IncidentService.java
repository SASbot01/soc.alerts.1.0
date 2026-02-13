package com.blackwolf.backend.service;

import com.blackwolf.backend.dto.IncidentDTOs.*;
import com.blackwolf.backend.model.Incident;
import com.blackwolf.backend.model.IncidentTimeline;
import com.blackwolf.backend.repository.IncidentRepository;
import com.blackwolf.backend.repository.IncidentTimelineRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Service
public class IncidentService {

    @Autowired
    private IncidentRepository incidentRepository;

    @Autowired
    private IncidentTimelineRepository timelineRepository;

    @Autowired
    private SseService sseService;

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
