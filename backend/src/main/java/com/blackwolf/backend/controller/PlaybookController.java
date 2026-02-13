package com.blackwolf.backend.controller;

import com.blackwolf.backend.dto.PlaybookDTOs.*;
import com.blackwolf.backend.model.Playbook;
import com.blackwolf.backend.model.PlaybookExecution;
import com.blackwolf.backend.service.PlaybookService;
import com.blackwolf.backend.util.AuthUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
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
    public ResponseEntity<List<Playbook>> list(Authentication auth) {
        return ResponseEntity.ok(playbookService.listByCompany(authUtils.getCompanyId(auth)));
    }

    @GetMapping("/{id}")
    public ResponseEntity<PlaybookDetailResponse> getDetail(Authentication auth, @PathVariable String id) {
        return ResponseEntity.ok(playbookService.getDetail(id, authUtils.getCompanyId(auth)));
    }

    @PostMapping
    public ResponseEntity<Playbook> create(Authentication auth, @RequestBody CreatePlaybookRequest request) {
        String companyId = authUtils.getCompanyId(auth);
        String performedBy = authUtils.getUser(auth).getEmail();
        return ResponseEntity.ok(playbookService.create(companyId, request, performedBy));
    }

    @PatchMapping("/{id}/toggle")
    public ResponseEntity<Playbook> toggleActive(Authentication auth, @PathVariable String id) {
        String companyId = authUtils.getCompanyId(auth);
        String performedBy = authUtils.getUser(auth).getEmail();
        return ResponseEntity.ok(playbookService.toggleActive(id, companyId, performedBy));
    }

    @PostMapping("/{id}/execute")
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
