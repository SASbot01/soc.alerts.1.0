package com.blackwolf.backend.controller;

import com.blackwolf.backend.dto.AlertDTOs.*;
import com.blackwolf.backend.model.AlertConfiguration;
import com.blackwolf.backend.model.AlertHistory;
import com.blackwolf.backend.service.AlertService;
import com.blackwolf.backend.util.AuthUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/alerts")
public class AlertController {

    @Autowired private AlertService alertService;
    @Autowired private AuthUtils authUtils;

    @GetMapping("/config")
    @PreAuthorize("@perm.has(authentication, 'alerts:read')")
    public ResponseEntity<List<AlertConfiguration>> listConfigs(Authentication auth) {
        String companyId = authUtils.getCompanyId(auth);
        return ResponseEntity.ok(alertService.listByCompany(companyId));
    }

    @PostMapping("/config")
    @PreAuthorize("@perm.has(authentication, 'alerts:write')")
    public ResponseEntity<AlertConfiguration> createConfig(@RequestBody CreateAlertConfigRequest request, Authentication auth) {
        String companyId = authUtils.getCompanyId(auth);
        return ResponseEntity.ok(alertService.createConfig(companyId, request));
    }

    @PutMapping("/config/{id}")
    @PreAuthorize("@perm.has(authentication, 'alerts:write')")
    public ResponseEntity<AlertConfiguration> updateConfig(@PathVariable String id, @RequestBody UpdateAlertConfigRequest request) {
        return ResponseEntity.ok(alertService.updateConfig(id, request));
    }

    @DeleteMapping("/config/{id}")
    @PreAuthorize("@perm.has(authentication, 'alerts:write')")
    public ResponseEntity<Void> deleteConfig(@PathVariable String id) {
        alertService.deleteConfig(id);
        return ResponseEntity.ok().build();
    }

    @GetMapping("/history")
    @PreAuthorize("@perm.has(authentication, 'alerts:read')")
    public ResponseEntity<List<AlertHistory>> history(Authentication auth) {
        String companyId = authUtils.getCompanyId(auth);
        return ResponseEntity.ok(alertService.getHistory(companyId));
    }
}
