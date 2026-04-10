package com.blackwolf.backend.controller;

import com.blackwolf.backend.model.ComplianceControl;
import com.blackwolf.backend.model.ComplianceFramework;
import com.blackwolf.backend.model.ComplianceResult;
import com.blackwolf.backend.service.ComplianceEngineService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/compliance")
@RequiredArgsConstructor
public class ComplianceController {

    private final ComplianceEngineService complianceEngineService;

    @GetMapping("/frameworks")
    public ResponseEntity<?> getFrameworks(@RequestParam String companyId) {
        return ResponseEntity.ok(complianceEngineService.getFrameworks(companyId));
    }

    @PostMapping("/frameworks")
    public ResponseEntity<?> createFramework(
            @RequestParam String companyId,
            @RequestBody ComplianceFramework framework) {
        return ResponseEntity.ok(complianceEngineService.createFramework(companyId, framework));
    }

    @GetMapping("/controls")
    public ResponseEntity<?> getControls(@RequestParam Long frameworkId) {
        return ResponseEntity.ok(complianceEngineService.getControls(frameworkId));
    }

    @PostMapping("/controls")
    public ResponseEntity<?> addControl(
            @RequestParam Long frameworkId,
            @RequestBody ComplianceControl control) {
        return ResponseEntity.ok(complianceEngineService.addControl(frameworkId, control));
    }

    @PostMapping("/assessments/start")
    public ResponseEntity<?> startAssessment(
            @RequestParam String companyId,
            @RequestParam Long frameworkId) {
        return ResponseEntity.ok(complianceEngineService.startAssessment(companyId, frameworkId));
    }

    @PostMapping("/assessments/{id}/results")
    public ResponseEntity<?> submitResult(
            @PathVariable Long id,
            @RequestBody ComplianceResult result) {
        return ResponseEntity.ok(complianceEngineService.submitResult(id, result));
    }

    @PostMapping("/assessments/{id}/complete")
    public ResponseEntity<?> completeAssessment(@PathVariable Long id) {
        return ResponseEntity.ok(complianceEngineService.completeAssessment(id));
    }

    @GetMapping("/assessments")
    public ResponseEntity<?> getAssessments(@RequestParam String companyId) {
        return ResponseEntity.ok(complianceEngineService.getAssessments(companyId));
    }

    @GetMapping("/assessments/{id}/results")
    public ResponseEntity<?> getAssessmentResults(@PathVariable Long id) {
        return ResponseEntity.ok(complianceEngineService.getAssessmentResults(id));
    }

    @GetMapping("/stats")
    public ResponseEntity<?> getStats(@RequestParam String companyId) {
        return ResponseEntity.ok(complianceEngineService.getStats(companyId));
    }
}
