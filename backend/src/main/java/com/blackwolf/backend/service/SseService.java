package com.blackwolf.backend.service;

import com.blackwolf.backend.model.Incident;
import com.blackwolf.backend.model.ThreatEvent;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;

@Service
public class SseService {

    private static final Logger log = LoggerFactory.getLogger(SseService.class);
    private static final long SSE_TIMEOUT = 300_000L; // 5 minutes

    // companyId -> list of emitters for that company
    private final Map<String, CopyOnWriteArrayList<SseEmitter>> companyEmitters = new ConcurrentHashMap<>();
    // superadmin emitters (receive ALL events)
    private final CopyOnWriteArrayList<SseEmitter> globalEmitters = new CopyOnWriteArrayList<>();

    public SseEmitter subscribe(String companyId) {
        SseEmitter emitter = new SseEmitter(SSE_TIMEOUT);

        CopyOnWriteArrayList<SseEmitter> emitters = companyEmitters
                .computeIfAbsent(companyId, k -> new CopyOnWriteArrayList<>());
        emitters.add(emitter);

        emitter.onCompletion(() -> emitters.remove(emitter));
        emitter.onTimeout(() -> emitters.remove(emitter));
        emitter.onError(e -> emitters.remove(emitter));

        // Send initial connection event
        try {
            emitter.send(SseEmitter.event()
                    .name("connected")
                    .data(Map.of("message", "SSE connected", "companyId", companyId)));
        } catch (IOException e) {
            emitters.remove(emitter);
        }

        log.debug("SSE client subscribed for company {}", companyId);
        return emitter;
    }

    public SseEmitter subscribeGlobal() {
        SseEmitter emitter = new SseEmitter(SSE_TIMEOUT);
        globalEmitters.add(emitter);

        emitter.onCompletion(() -> globalEmitters.remove(emitter));
        emitter.onTimeout(() -> globalEmitters.remove(emitter));
        emitter.onError(e -> globalEmitters.remove(emitter));

        try {
            emitter.send(SseEmitter.event()
                    .name("connected")
                    .data(Map.of("message", "Global SSE connected")));
        } catch (IOException e) {
            globalEmitters.remove(emitter);
        }

        return emitter;
    }

    public void emitThreat(ThreatEvent threat) {
        Map<String, Object> data = Map.of(
                "id", threat.getId(),
                "threatType", threat.getThreatType(),
                "severity", threat.getSeverity(),
                "srcIp", threat.getSrcIp() != null ? threat.getSrcIp() : "",
                "dstIp", threat.getDstIp() != null ? threat.getDstIp() : "",
                "status", threat.getStatus(),
                "timestamp", threat.getTimestamp().toString(),
                "companyId", threat.getCompanyId()
        );

        sendToCompany(threat.getCompanyId(), "threat", data);
        sendToGlobal("threat", data);
    }

    public void emitIncident(Incident incident) {
        Map<String, Object> data = Map.of(
                "id", incident.getId(),
                "title", incident.getTitle(),
                "severity", incident.getSeverity(),
                "status", incident.getStatus(),
                "companyId", incident.getCompanyId()
        );

        sendToCompany(incident.getCompanyId(), "incident", data);
        sendToGlobal("incident", data);
    }

    public void emitAlert(String companyId, String alertType, String message) {
        Map<String, Object> data = Map.of(
                "alertType", alertType,
                "message", message,
                "companyId", companyId
        );

        sendToCompany(companyId, "alert", data);
        sendToGlobal("alert", data);
    }

    public void emitDashboardUpdate(String companyId) {
        sendToCompany(companyId, "dashboard_update", Map.of("companyId", companyId));
    }

    private void sendToCompany(String companyId, String eventName, Object data) {
        CopyOnWriteArrayList<SseEmitter> emitters = companyEmitters.get(companyId);
        if (emitters == null || emitters.isEmpty()) return;

        for (SseEmitter emitter : emitters) {
            try {
                emitter.send(SseEmitter.event().name(eventName).data(data));
            } catch (IOException e) {
                emitters.remove(emitter);
            }
        }
    }

    private void sendToGlobal(String eventName, Object data) {
        for (SseEmitter emitter : globalEmitters) {
            try {
                emitter.send(SseEmitter.event().name(eventName).data(data));
            } catch (IOException e) {
                globalEmitters.remove(emitter);
            }
        }
    }
}
