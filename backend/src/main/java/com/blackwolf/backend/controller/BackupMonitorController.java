package com.blackwolf.backend.controller;

import com.blackwolf.backend.dto.InfrastructureDTOs.*;
import com.blackwolf.backend.model.BackupStatus;
import com.blackwolf.backend.service.BackupMonitorService;
import com.blackwolf.backend.util.AuthUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/backups")
public class BackupMonitorController {

    @Autowired
    private BackupMonitorService backupMonitorService;

    @Autowired
    private AuthUtils authUtils;

    // Public endpoint for agents to report backup status (API key auth like sensors/upload)
    @PostMapping("/report")
    public ResponseEntity<BackupStatus> reportBackup(@RequestBody BackupReportRequest request) {
        return ResponseEntity.ok(backupMonitorService.reportBackup(request));
    }

    @GetMapping("/dashboard")
    @PreAuthorize("@perm.has(authentication, 'dashboard:read')")
    public ResponseEntity<BackupDashboard> getDashboard(Authentication auth) {
        String companyId = authUtils.getCompanyId(auth);
        return ResponseEntity.ok(backupMonitorService.getDashboard(companyId));
    }

    @GetMapping("/history")
    @PreAuthorize("@perm.has(authentication, 'dashboard:read')")
    public ResponseEntity<List<BackupStatus>> getHistory(Authentication auth) {
        String companyId = authUtils.getCompanyId(auth);
        return ResponseEntity.ok(backupMonitorService.getHistory(companyId));
    }
}
