package com.blackwolf.backend.controller;

import com.blackwolf.backend.model.ForensicCase;
import com.blackwolf.backend.model.ForensicEvidence;
import com.blackwolf.backend.model.ForensicTimeline;
import com.blackwolf.backend.service.ForensicService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/forensics")
@RequiredArgsConstructor
public class ForensicController {

    private final ForensicService forensicService;

    @GetMapping("/cases")
    public ResponseEntity<?> getCases(@RequestParam String companyId) {
        return ResponseEntity.ok(forensicService.getCases(companyId));
    }

    @PostMapping("/cases")
    public ResponseEntity<?> createCase(
            @RequestParam String companyId,
            @RequestBody ForensicCase forensicCase) {
        return ResponseEntity.ok(forensicService.createCase(companyId, forensicCase));
    }

    @PutMapping("/cases/{id}")
    public ResponseEntity<?> updateCase(
            @PathVariable Long id,
            @RequestBody ForensicCase forensicCase) {
        return ResponseEntity.ok(forensicService.updateCase(id, forensicCase));
    }

    @PostMapping("/cases/{id}/close")
    public ResponseEntity<?> closeCase(@PathVariable Long id) {
        return ResponseEntity.ok(forensicService.closeCase(id));
    }

    @PostMapping("/cases/{caseId}/evidence")
    public ResponseEntity<?> addEvidence(
            @PathVariable Long caseId,
            @RequestBody ForensicEvidence evidence) {
        return ResponseEntity.ok(forensicService.addEvidence(caseId, evidence));
    }

    @GetMapping("/cases/{caseId}/evidence")
    public ResponseEntity<?> getEvidence(@PathVariable Long caseId) {
        return ResponseEntity.ok(forensicService.getEvidence(caseId));
    }

    @PostMapping("/cases/{caseId}/timeline")
    public ResponseEntity<?> addTimelineEvent(
            @PathVariable Long caseId,
            @RequestBody ForensicTimeline timelineEvent) {
        return ResponseEntity.ok(forensicService.addTimelineEvent(caseId, timelineEvent));
    }

    @GetMapping("/cases/{caseId}/timeline")
    public ResponseEntity<?> getTimeline(@PathVariable Long caseId) {
        return ResponseEntity.ok(forensicService.getTimeline(caseId));
    }

    @GetMapping("/stats")
    public ResponseEntity<?> getStats(@RequestParam String companyId) {
        return ResponseEntity.ok(forensicService.getStats(companyId));
    }
}
