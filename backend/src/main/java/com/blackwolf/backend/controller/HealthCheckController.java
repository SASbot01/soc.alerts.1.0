package com.blackwolf.backend.controller;

import com.blackwolf.backend.dto.InfrastructureDTOs.*;
import com.blackwolf.backend.model.HealthCheckTarget;
import com.blackwolf.backend.service.HealthCheckService;
import com.blackwolf.backend.util.AuthUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/health-checks")
public class HealthCheckController {

    @Autowired
    private HealthCheckService healthCheckService;

    @Autowired
    private AuthUtils authUtils;

    @GetMapping("/dashboard")
    @PreAuthorize("@perm.has(authentication, 'dashboard:read')")
    public ResponseEntity<HealthCheckDashboard> getDashboard(Authentication auth) {
        String companyId = authUtils.getCompanyId(auth);
        return ResponseEntity.ok(healthCheckService.getDashboard(companyId));
    }

    @GetMapping("/targets")
    @PreAuthorize("@perm.has(authentication, 'dashboard:read')")
    public ResponseEntity<List<HealthCheckTarget>> listTargets(Authentication auth) {
        String companyId = authUtils.getCompanyId(auth);
        return ResponseEntity.ok(healthCheckService.listTargets(companyId));
    }

    @PostMapping("/targets")
    @PreAuthorize("@perm.has(authentication, 'settings:write')")
    public ResponseEntity<HealthCheckTarget> createTarget(Authentication auth, @RequestBody CreateHealthCheckRequest request) {
        String companyId = authUtils.getCompanyId(auth);
        return ResponseEntity.ok(healthCheckService.createTarget(companyId, request));
    }

    @DeleteMapping("/targets/{id}")
    @PreAuthorize("@perm.has(authentication, 'settings:write')")
    public ResponseEntity<Map<String, String>> deleteTarget(Authentication auth, @PathVariable String id) {
        String companyId = authUtils.getCompanyId(auth);
        healthCheckService.deleteTarget(id, companyId);
        return ResponseEntity.ok(Map.of("status", "deleted"));
    }

    @PostMapping("/targets/{id}/toggle")
    @PreAuthorize("@perm.has(authentication, 'settings:write')")
    public ResponseEntity<HealthCheckTarget> toggleTarget(Authentication auth, @PathVariable String id) {
        String companyId = authUtils.getCompanyId(auth);
        return ResponseEntity.ok(healthCheckService.toggleTarget(id, companyId));
    }

    @PostMapping("/targets/{id}/run")
    @PreAuthorize("@perm.has(authentication, 'dashboard:read')")
    public ResponseEntity<RunHealthCheckResponse> runCheck(Authentication auth, @PathVariable String id) {
        String companyId = authUtils.getCompanyId(auth);
        return ResponseEntity.ok(healthCheckService.runCheck(id, companyId));
    }

    @PostMapping("/run-all")
    @PreAuthorize("@perm.has(authentication, 'dashboard:read')")
    public ResponseEntity<List<RunHealthCheckResponse>> runAllChecks(Authentication auth) {
        String companyId = authUtils.getCompanyId(auth);
        return ResponseEntity.ok(healthCheckService.runAllChecks(companyId));
    }
}
