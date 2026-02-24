package com.blackwolf.backend.controller;

import com.blackwolf.backend.model.ApiKey;
import com.blackwolf.backend.model.DataRetentionLog;
import com.blackwolf.backend.service.ApiKeyService;
import com.blackwolf.backend.service.DataRetentionService;
import com.blackwolf.backend.util.AuthUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/api-keys")
public class ApiKeyController {

    @Autowired
    private ApiKeyService apiKeyService;

    @Autowired
    private DataRetentionService dataRetentionService;

    @Autowired
    private AuthUtils authUtils;

    @GetMapping
    @PreAuthorize("@perm.has(authentication, 'settings:read')")
    public ResponseEntity<List<ApiKey>> list(Authentication auth) {
        String companyId = authUtils.getCompanyId(auth);
        return ResponseEntity.ok(apiKeyService.listByCompany(companyId));
    }

    @PostMapping
    @PreAuthorize("@perm.has(authentication, 'settings:write')")
    public ResponseEntity<Map<String, Object>> create(
            Authentication auth,
            @RequestBody Map<String, String> body) {
        String companyId = authUtils.getCompanyId(auth);
        String userId = authUtils.getUserId(auth);
        String name = body.getOrDefault("name", "API Key");
        String scopes = body.getOrDefault("scopes", "sensor:upload");

        ApiKeyService.CreateKeyResult result = apiKeyService.createApiKey(companyId, name, scopes, userId);
        return ResponseEntity.ok(Map.of(
                "apiKey", result.getApiKey(),
                "rawKey", result.getRawKey()
        ));
    }

    @PostMapping("/{id}/revoke")
    @PreAuthorize("@perm.has(authentication, 'settings:write')")
    public ResponseEntity<ApiKey> revoke(Authentication auth, @PathVariable String id) {
        String companyId = authUtils.getCompanyId(auth);
        return ResponseEntity.ok(apiKeyService.revokeKey(id, companyId));
    }

    @PostMapping("/{id}/rotate")
    @PreAuthorize("@perm.has(authentication, 'settings:write')")
    public ResponseEntity<Map<String, Object>> rotate(Authentication auth, @PathVariable String id) {
        String companyId = authUtils.getCompanyId(auth);
        String userId = authUtils.getUserId(auth);
        ApiKeyService.CreateKeyResult result = apiKeyService.rotateKey(id, companyId, userId);
        return ResponseEntity.ok(Map.of(
                "apiKey", result.getApiKey(),
                "rawKey", result.getRawKey()
        ));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("@perm.has(authentication, 'settings:write')")
    public ResponseEntity<Void> delete(Authentication auth, @PathVariable String id) {
        String companyId = authUtils.getCompanyId(auth);
        apiKeyService.deleteKey(id, companyId);
        return ResponseEntity.ok().build();
    }

    // Retention logs endpoint
    @GetMapping("/retention-logs")
    @PreAuthorize("@perm.has(authentication, 'settings:read')")
    public ResponseEntity<List<DataRetentionLog>> retentionLogs(Authentication auth) {
        String companyId = authUtils.getCompanyId(auth);
        return ResponseEntity.ok(dataRetentionService.getRetentionLogs(companyId));
    }
}
