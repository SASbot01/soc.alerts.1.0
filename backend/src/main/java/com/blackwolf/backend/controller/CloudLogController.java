package com.blackwolf.backend.controller;

import com.blackwolf.backend.model.CloudLogSource;
import com.blackwolf.backend.service.cloudlogs.CloudLogIngestionService;
import com.blackwolf.backend.util.AuthUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/cloud-logs")
public class CloudLogController {

    @Autowired
    private CloudLogIngestionService cloudLogIngestionService;

    @Autowired
    private AuthUtils authUtils;

    @GetMapping
    @PreAuthorize("@perm.has(authentication, 'sensors:write')")
    public ResponseEntity<List<CloudLogSource>> list(Authentication auth) {
        String companyId = authUtils.getCompanyId(auth);
        return ResponseEntity.ok(cloudLogIngestionService.listSources(companyId));
    }

    @PostMapping
    @PreAuthorize("@perm.has(authentication, 'sensors:write')")
    public ResponseEntity<CloudLogSource> create(Authentication auth, @RequestBody Map<String, Object> request) {
        String companyId = authUtils.getCompanyId(auth);
        String performedBy = authUtils.getUserId(auth);
        return ResponseEntity.ok(cloudLogIngestionService.createSource(companyId, request, performedBy));
    }

    @PutMapping("/{id}")
    @PreAuthorize("@perm.has(authentication, 'sensors:write')")
    public ResponseEntity<CloudLogSource> update(Authentication auth, @PathVariable String id,
                                                  @RequestBody Map<String, Object> request) {
        String companyId = authUtils.getCompanyId(auth);
        String performedBy = authUtils.getUserId(auth);
        return ResponseEntity.ok(cloudLogIngestionService.updateSource(companyId, id, request, performedBy));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("@perm.has(authentication, 'sensors:write')")
    public ResponseEntity<Map<String, String>> delete(Authentication auth, @PathVariable String id) {
        String companyId = authUtils.getCompanyId(auth);
        String performedBy = authUtils.getUserId(auth);
        cloudLogIngestionService.deleteSource(companyId, id, performedBy);
        return ResponseEntity.ok(Map.of("status", "deleted"));
    }

    @PostMapping("/{id}/toggle")
    @PreAuthorize("@perm.has(authentication, 'sensors:write')")
    public ResponseEntity<CloudLogSource> toggle(Authentication auth, @PathVariable String id) {
        String companyId = authUtils.getCompanyId(auth);
        String performedBy = authUtils.getUserId(auth);
        return ResponseEntity.ok(cloudLogIngestionService.toggleActive(companyId, id, performedBy));
    }

    @PostMapping("/{id}/test")
    @PreAuthorize("@perm.has(authentication, 'sensors:write')")
    public ResponseEntity<Map<String, Object>> test(Authentication auth, @PathVariable String id) {
        String companyId = authUtils.getCompanyId(auth);
        return ResponseEntity.ok(cloudLogIngestionService.testConnection(companyId, id));
    }
}
