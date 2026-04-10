package com.blackwolf.backend.controller;

import com.blackwolf.backend.model.AiEvolutionSnapshot;
import com.blackwolf.backend.model.AiIncidentStudy;
import com.blackwolf.backend.service.AiEvolutionService;
import com.blackwolf.backend.service.AiIncidentStudyService;
import com.blackwolf.backend.service.ReportService;
import com.blackwolf.backend.util.AuthUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/ai-agent/evolution")
public class AiEvolutionController {

    @Autowired private AiIncidentStudyService studyService;
    @Autowired private AiEvolutionService evolutionService;
    @Autowired private ReportService reportService;
    @Autowired private AuthUtils authUtils;

    // ===== Studies =====

    @GetMapping("/studies")
    public ResponseEntity<List<AiIncidentStudy>> listStudies(
            @RequestParam(required = false) String type,
            Authentication auth) {
        String companyId = authUtils.getCompanyId(auth);
        return ResponseEntity.ok(studyService.getStudies(companyId, type));
    }

    @GetMapping("/studies/{id}")
    public ResponseEntity<AiIncidentStudy> getStudy(@PathVariable String id, Authentication auth) {
        String companyId = authUtils.getCompanyId(auth);
        return studyService.getStudy(id)
                .filter(s -> s.getCompanyId().equals(companyId))
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/studies/{incidentId}/analyze")
    public ResponseEntity<AiIncidentStudy> triggerStudy(
            @PathVariable String incidentId, Authentication auth) {
        String companyId = authUtils.getCompanyId(auth);
        AiIncidentStudy study = studyService.studyIncident(companyId, incidentId);
        if (study == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(study);
    }

    // ===== Snapshots =====

    @GetMapping("/snapshots")
    public ResponseEntity<List<AiEvolutionSnapshot>> listSnapshots(Authentication auth) {
        String companyId = authUtils.getCompanyId(auth);
        return ResponseEntity.ok(evolutionService.getSnapshots(companyId));
    }

    // ===== Timeline & Dashboard =====

    @GetMapping("/timeline")
    public ResponseEntity<Map<String, Object>> getTimeline(
            @RequestParam(defaultValue = "30") int days,
            Authentication auth) {
        String companyId = authUtils.getCompanyId(auth);
        return ResponseEntity.ok(evolutionService.getEvolutionTimeline(companyId, days));
    }

    @GetMapping("/dashboard")
    public ResponseEntity<Map<String, Object>> getDashboard(Authentication auth) {
        String companyId = authUtils.getCompanyId(auth);
        return ResponseEntity.ok(evolutionService.getDashboardStats(companyId));
    }

    // ===== Maintenance =====

    /**
     * Purge corrupted/degenerate AI studies caused by feedback loops.
     * Marks them as FAILED so they are excluded from future analysis context.
     */
    @PostMapping("/studies/purge-corrupted")
    public ResponseEntity<Map<String, Object>> purgeCorruptedStudies(Authentication auth) {
        String companyId = authUtils.getCompanyId(auth);
        int purged = studyService.purgeCorruptedStudies(companyId);
        return ResponseEntity.ok(Map.of(
                "purged", purged,
                "message", purged > 0
                        ? purged + " corrupted studies purged. Circuit breaker reset. New studies will start fresh."
                        : "No corrupted studies found."
        ));
    }

    /**
     * Reset the circuit breaker if it was triggered.
     */
    @PostMapping("/studies/reset-circuit-breaker")
    public ResponseEntity<Map<String, Object>> resetCircuitBreaker(Authentication auth) {
        String companyId = authUtils.getCompanyId(auth);
        studyService.resetCircuitBreaker(companyId);
        return ResponseEntity.ok(Map.of("message", "Circuit breaker reset for company. Studies will resume."));
    }

    // ===== PDF Report =====

    @GetMapping("/reports/pdf")
    public ResponseEntity<byte[]> downloadEvolutionPDF(
            @RequestParam(defaultValue = "30") int days,
            Authentication auth) throws Exception {
        String companyId = authUtils.getCompanyId(auth);
        byte[] pdf = reportService.generateAiEvolutionReport(companyId, days);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=ai-evolution-report.pdf")
                .contentType(MediaType.APPLICATION_PDF)
                .body(pdf);
    }
}
