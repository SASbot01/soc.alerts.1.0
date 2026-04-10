package com.blackwolf.backend.controller;

import com.blackwolf.backend.model.CloudAccount;
import com.blackwolf.backend.model.CloudFinding;
import com.blackwolf.backend.service.CloudSecurityService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/cloud-security")
@RequiredArgsConstructor
public class CloudSecurityController {

    private final CloudSecurityService cloudSecurityService;

    @GetMapping("/accounts")
    public ResponseEntity<?> getAccounts(@RequestParam String companyId) {
        return ResponseEntity.ok(cloudSecurityService.getAccounts(companyId));
    }

    @PostMapping("/accounts")
    public ResponseEntity<?> addAccount(
            @RequestParam String companyId,
            @RequestBody CloudAccount account) {
        return ResponseEntity.ok(cloudSecurityService.addAccount(companyId, account));
    }

    @DeleteMapping("/accounts/{id}")
    public ResponseEntity<?> removeAccount(@PathVariable Long id) {
        cloudSecurityService.removeAccount(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/accounts/{id}/findings")
    public ResponseEntity<?> getFindings(@PathVariable Long id) {
        return ResponseEntity.ok(cloudSecurityService.getFindings(id));
    }

    @PostMapping("/accounts/{id}/findings")
    public ResponseEntity<?> addFinding(
            @PathVariable Long id,
            @RequestBody CloudFinding finding) {
        return ResponseEntity.ok(cloudSecurityService.addFinding(id, finding));
    }

    @PostMapping("/findings/{id}/resolve")
    public ResponseEntity<?> resolveFindings(@PathVariable Long id) {
        return ResponseEntity.ok(cloudSecurityService.resolveFindings(id));
    }

    @GetMapping("/stats")
    public ResponseEntity<?> getStats(@RequestParam String companyId) {
        return ResponseEntity.ok(cloudSecurityService.getStats(companyId));
    }
}
