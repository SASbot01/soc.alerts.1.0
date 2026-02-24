package com.blackwolf.backend.controller;

import com.blackwolf.backend.model.AiAgentReport;
import com.blackwolf.backend.model.AiDecision;
import com.blackwolf.backend.model.AiNoisePattern;
import com.blackwolf.backend.service.AiAutonomousAgentService;
import com.blackwolf.backend.service.AiThreatAnalystService;
import com.blackwolf.backend.util.AuthUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/ai-agent")
public class AiAgentController {

    @Autowired
    private AiThreatAnalystService aiThreatAnalystService;

    @Autowired
    private AiAutonomousAgentService aiAutonomousAgentService;

    @Autowired
    private AuthUtils authUtils;

    // ===== Scheduled Reports =====

    @PostMapping("/analyze")
    public ResponseEntity<List<AiAgentReport>> triggerAnalysis(Authentication auth) {
        String companyId = authUtils.getCompanyId(auth);
        List<AiAgentReport> reports = aiThreatAnalystService.analyzeCompany(companyId);
        return ResponseEntity.ok(reports);
    }

    @GetMapping("/reports")
    public ResponseEntity<List<AiAgentReport>> listReports(
            @RequestParam(required = false) String type,
            Authentication auth) {
        String companyId = authUtils.getCompanyId(auth);
        List<AiAgentReport> reports = aiThreatAnalystService.getReports(companyId, type);
        return ResponseEntity.ok(reports);
    }

    @GetMapping("/reports/{id}")
    public ResponseEntity<AiAgentReport> getReport(
            @PathVariable String id, Authentication auth) {
        String companyId = authUtils.getCompanyId(auth);
        return aiThreatAnalystService.getReport(id)
                .filter(r -> r.getCompanyId().equals(companyId))
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    // ===== Autonomous Agent - Decisions =====

    @GetMapping("/autonomous/stats")
    public ResponseEntity<Map<String, Object>> getAutonomousStats(Authentication auth) {
        String companyId = authUtils.getCompanyId(auth);
        return ResponseEntity.ok(aiAutonomousAgentService.getStats(companyId));
    }

    @GetMapping("/autonomous/decisions")
    public ResponseEntity<List<AiDecision>> listDecisions(
            @RequestParam(required = false) String verdict,
            Authentication auth) {
        String companyId = authUtils.getCompanyId(auth);
        return ResponseEntity.ok(aiAutonomousAgentService.getDecisions(companyId, verdict));
    }

    @GetMapping("/autonomous/token-stats")
    public ResponseEntity<Map<String, Object>> getTokenStats(Authentication auth) {
        String companyId = authUtils.getCompanyId(auth);
        return ResponseEntity.ok(aiAutonomousAgentService.getTokenStats(companyId));
    }

    // ===== Autonomous Agent - Noise Patterns =====

    @GetMapping("/autonomous/noise-patterns")
    public ResponseEntity<List<AiNoisePattern>> listNoisePatterns(Authentication auth) {
        String companyId = authUtils.getCompanyId(auth);
        return ResponseEntity.ok(aiAutonomousAgentService.getNoisePatterns(companyId));
    }

    @PatchMapping("/autonomous/noise-patterns/{id}/toggle")
    public ResponseEntity<Void> toggleNoisePattern(@PathVariable String id) {
        aiAutonomousAgentService.toggleNoisePattern(id, true);
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/autonomous/noise-patterns/{id}")
    public ResponseEntity<Void> deleteNoisePattern(@PathVariable String id) {
        aiAutonomousAgentService.deleteNoisePattern(id);
        return ResponseEntity.ok().build();
    }
}
