package com.blackwolf.backend.controller;

import com.blackwolf.backend.model.VulnFinding;
import com.blackwolf.backend.model.VulnScan;
import com.blackwolf.backend.service.VulnScanService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/vuln-scanner")
@RequiredArgsConstructor
public class VulnScanController {

    private final VulnScanService vulnScanService;

    @GetMapping("/scans")
    public ResponseEntity<?> getScans(@RequestParam String companyId) {
        return ResponseEntity.ok(vulnScanService.getScans(companyId));
    }

    @PostMapping("/scans")
    public ResponseEntity<?> createScan(
            @RequestParam String companyId,
            @RequestBody VulnScan scan) {
        return ResponseEntity.ok(vulnScanService.createScan(companyId, scan));
    }

    @GetMapping("/scans/{id}/findings")
    public ResponseEntity<?> getScanFindings(@PathVariable Long id) {
        return ResponseEntity.ok(vulnScanService.getScanFindings(id));
    }

    @PostMapping("/scans/{id}/findings")
    public ResponseEntity<?> addFinding(
            @PathVariable Long id,
            @RequestBody VulnFinding finding) {
        return ResponseEntity.ok(vulnScanService.addFinding(id, finding));
    }

    @PostMapping("/scans/{id}/complete")
    public ResponseEntity<?> completeScan(@PathVariable Long id) {
        return ResponseEntity.ok(vulnScanService.completeScan(id));
    }

    @PutMapping("/findings/{id}/status")
    public ResponseEntity<?> updateFindingStatus(
            @PathVariable Long id,
            @RequestParam String status) {
        return ResponseEntity.ok(vulnScanService.updateFindingStatus(id, status));
    }

    @GetMapping("/stats")
    public ResponseEntity<?> getStats(@RequestParam String companyId) {
        return ResponseEntity.ok(vulnScanService.getStats(companyId));
    }
}
