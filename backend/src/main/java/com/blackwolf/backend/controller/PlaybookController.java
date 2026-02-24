package com.blackwolf.backend.controller;

import com.blackwolf.backend.dto.PlaybookDTOs.*;
import com.blackwolf.backend.model.Playbook;
import com.blackwolf.backend.model.PlaybookExecution;
import com.blackwolf.backend.service.PlaybookService;
import com.blackwolf.backend.util.AuthUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/playbooks")
public class PlaybookController {

    @Autowired
    private PlaybookService playbookService;

    @Autowired
    private AuthUtils authUtils;

    @GetMapping
    @PreAuthorize("@perm.has(authentication, 'playbooks:read')")
    public ResponseEntity<List<Playbook>> list(Authentication auth) {
        return ResponseEntity.ok(playbookService.listByCompany(authUtils.getCompanyId(auth)));
    }

    @GetMapping("/{id}")
    @PreAuthorize("@perm.has(authentication, 'playbooks:read')")
    public ResponseEntity<PlaybookDetailResponse> getDetail(Authentication auth, @PathVariable String id) {
        return ResponseEntity.ok(playbookService.getDetail(id, authUtils.getCompanyId(auth)));
    }

    @PostMapping
    @PreAuthorize("@perm.has(authentication, 'playbooks:write')")
    public ResponseEntity<Playbook> create(Authentication auth, @RequestBody CreatePlaybookRequest request) {
        String companyId = authUtils.getCompanyId(auth);
        String performedBy = authUtils.getUser(auth).getEmail();
        return ResponseEntity.ok(playbookService.create(companyId, request, performedBy));
    }

    @PatchMapping("/{id}/toggle")
    @PreAuthorize("@perm.has(authentication, 'playbooks:write')")
    public ResponseEntity<Playbook> toggleActive(Authentication auth, @PathVariable String id) {
        String companyId = authUtils.getCompanyId(auth);
        String performedBy = authUtils.getUser(auth).getEmail();
        return ResponseEntity.ok(playbookService.toggleActive(id, companyId, performedBy));
    }

    @PostMapping("/{id}/execute")
    @PreAuthorize("@perm.has(authentication, 'playbooks:execute')")
    public ResponseEntity<PlaybookExecution> execute(Authentication auth, @PathVariable String id) {
        String companyId = authUtils.getCompanyId(auth);
        String performedBy = authUtils.getUser(auth).getEmail();
        return ResponseEntity.ok(playbookService.executeManually(id, companyId, performedBy));
    }

    @GetMapping("/executions")
    public ResponseEntity<List<ExecutionSummary>> listExecutions(Authentication auth) {
        return ResponseEntity.ok(playbookService.listExecutions(authUtils.getCompanyId(auth)));
    }

    @GetMapping("/executions/{id}")
    public ResponseEntity<ExecutionDetailResponse> getExecutionDetail(Authentication auth, @PathVariable String id) {
        return ResponseEntity.ok(playbookService.getExecutionDetail(id, authUtils.getCompanyId(auth)));
    }

    // ===== Visual Builder =====

    @GetMapping("/{id}/graph")
    @PreAuthorize("@perm.has(authentication, 'playbooks:read')")
    public ResponseEntity<Map<String, Object>> getGraph(Authentication auth, @PathVariable String id) {
        return ResponseEntity.ok(playbookService.getGraph(id, authUtils.getCompanyId(auth)));
    }

    @PutMapping("/{id}/graph")
    @PreAuthorize("@perm.has(authentication, 'playbooks:write')")
    public ResponseEntity<Map<String, Object>> saveGraph(Authentication auth, @PathVariable String id, @RequestBody Map<String, Object> graphData) {
        String companyId = authUtils.getCompanyId(auth);
        String performedBy = authUtils.getUser(auth).getEmail();
        return ResponseEntity.ok(playbookService.saveGraph(id, companyId, graphData, performedBy));
    }

    // ===== Template Endpoints =====

    @GetMapping("/templates")
    public ResponseEntity<List<PlaybookTemplateResponse>> listTemplates(Authentication auth) {
        return ResponseEntity.ok(playbookService.listTemplates(authUtils.getCompanyId(auth)));
    }

    @PostMapping("/templates/deploy")
    public ResponseEntity<Playbook> deployTemplate(Authentication auth, @RequestBody DeployTemplateRequest request) {
        String companyId = authUtils.getCompanyId(auth);
        String performedBy = authUtils.getUser(auth).getEmail();
        return ResponseEntity.ok(playbookService.deployTemplate(companyId, request, performedBy));
    }

    // ===== Assignment Endpoints =====

    @PostMapping("/assignments")
    public ResponseEntity<AssetPlaybookAssignmentResponse> assign(Authentication auth, @RequestBody AssignPlaybookRequest request) {
        String companyId = authUtils.getCompanyId(auth);
        String performedBy = authUtils.getUser(auth).getEmail();
        return ResponseEntity.ok(playbookService.assignToAsset(companyId, request, performedBy));
    }

    @PostMapping("/assignments/bulk")
    public ResponseEntity<List<AssetPlaybookAssignmentResponse>> bulkAssign(Authentication auth, @RequestBody BulkAssignRequest request) {
        String companyId = authUtils.getCompanyId(auth);
        String performedBy = authUtils.getUser(auth).getEmail();
        return ResponseEntity.ok(playbookService.bulkAssign(companyId, request, performedBy));
    }

    @DeleteMapping("/assignments/{playbookId}/{assetId}")
    public ResponseEntity<Map<String, String>> unassign(Authentication auth,
            @PathVariable String playbookId, @PathVariable String assetId) {
        String companyId = authUtils.getCompanyId(auth);
        String performedBy = authUtils.getUser(auth).getEmail();
        playbookService.unassignFromAsset(companyId, playbookId, assetId, performedBy);
        return ResponseEntity.ok(Map.of("status", "unassigned"));
    }

    @GetMapping("/{id}/assignments")
    public ResponseEntity<List<AssetPlaybookAssignmentResponse>> getPlaybookAssignments(Authentication auth, @PathVariable String id) {
        return ResponseEntity.ok(playbookService.getPlaybookAssignments(id, authUtils.getCompanyId(auth)));
    }
}
