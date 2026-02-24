package com.blackwolf.backend.controller;

import com.blackwolf.backend.dto.IntegrationDTOs.*;
import com.blackwolf.backend.service.IntegrationService;
import com.blackwolf.backend.util.AuthUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/integrations")
public class IntegrationController {

    @Autowired
    private IntegrationService integrationService;

    @Autowired
    private AuthUtils authUtils;

    @GetMapping
    @PreAuthorize("@perm.has(authentication, 'integrations:read')")
    public ResponseEntity<List<IntegrationResponse>> list(Authentication auth) {
        String companyId = authUtils.getCompanyId(auth);
        return ResponseEntity.ok(integrationService.listIntegrations(companyId));
    }

    @GetMapping("/overview")
    @PreAuthorize("@perm.has(authentication, 'integrations:read')")
    public ResponseEntity<IntegrationOverview> overview(Authentication auth) {
        String companyId = authUtils.getCompanyId(auth);
        return ResponseEntity.ok(integrationService.getOverview(companyId));
    }

    @GetMapping("/providers")
    @PreAuthorize("@perm.has(authentication, 'integrations:read')")
    public ResponseEntity<List<AvailableProvider>> providers(Authentication auth) {
        String companyId = authUtils.getCompanyId(auth);
        return ResponseEntity.ok(integrationService.getAvailableProviders(companyId));
    }

    @PostMapping
    @PreAuthorize("@perm.has(authentication, 'integrations:write')")
    public ResponseEntity<IntegrationResponse> save(Authentication auth, @RequestBody SaveIntegrationRequest request) {
        String companyId = authUtils.getCompanyId(auth);
        return ResponseEntity.ok(integrationService.saveIntegration(companyId, request));
    }

    @PostMapping("/{id}/toggle")
    @PreAuthorize("@perm.has(authentication, 'integrations:write')")
    public ResponseEntity<Map<String, String>> toggle(Authentication auth, @PathVariable String id) {
        String companyId = authUtils.getCompanyId(auth);
        integrationService.toggleActive(companyId, id);
        return ResponseEntity.ok(Map.of("status", "toggled"));
    }

    @PostMapping("/{id}/test")
    @PreAuthorize("@perm.has(authentication, 'integrations:write')")
    public ResponseEntity<TestConnectionResponse> test(Authentication auth, @PathVariable String id) {
        String companyId = authUtils.getCompanyId(auth);
        return ResponseEntity.ok(integrationService.testConnection(companyId, id));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("@perm.has(authentication, 'integrations:write')")
    public ResponseEntity<Map<String, String>> delete(Authentication auth, @PathVariable String id) {
        String companyId = authUtils.getCompanyId(auth);
        integrationService.deleteIntegration(companyId, id);
        return ResponseEntity.ok(Map.of("status", "deleted"));
    }

    @PostMapping("/{id}/ticket/{incidentId}")
    @PreAuthorize("@perm.has(authentication, 'integrations:write')")
    public ResponseEntity<TicketResponse> createTicket(Authentication auth, @PathVariable String id, @PathVariable String incidentId) {
        String companyId = authUtils.getCompanyId(auth);
        return ResponseEntity.ok(integrationService.createTicket(companyId, incidentId, id));
    }

    @PostMapping("/{id}/page/{incidentId}")
    @PreAuthorize("@perm.has(authentication, 'integrations:write')")
    public ResponseEntity<PageResponse> pageIncident(Authentication auth, @PathVariable String id, @PathVariable String incidentId) {
        String companyId = authUtils.getCompanyId(auth);
        return ResponseEntity.ok(integrationService.pageIncident(companyId, incidentId, id));
    }

    @GetMapping("/tickets/{incidentId}")
    @PreAuthorize("@perm.has(authentication, 'integrations:read')")
    public ResponseEntity<List<TicketResponse>> getTickets(@PathVariable String incidentId) {
        return ResponseEntity.ok(integrationService.getTicketsForIncident(incidentId));
    }
}
