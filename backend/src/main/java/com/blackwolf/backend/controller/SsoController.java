package com.blackwolf.backend.controller;

import com.blackwolf.backend.model.SsoConfiguration;
import com.blackwolf.backend.service.SsoService;
import com.blackwolf.backend.util.AuthUtils;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/sso")
public class SsoController {

    @Autowired
    private SsoService ssoService;

    @Autowired
    private AuthUtils authUtils;

    @Value("${app.base-url:https://soc.blackwolfsec.io}")
    private String baseUrl;

    // ===== Public endpoints (no auth required) =====

    /**
     * Check if SSO is enabled for a company domain.
     */
    @GetMapping("/check")
    public ResponseEntity<Map<String, Object>> checkSso(@RequestParam String domain) {
        boolean enabled = ssoService.isSsoEnabled(domain);
        return ResponseEntity.ok(Map.of("ssoEnabled", enabled));
    }

    /**
     * Initiate SSO login — returns the authorization URL.
     */
    @PostMapping("/authorize")
    public ResponseEntity<Map<String, String>> authorize(@RequestBody Map<String, String> body) {
        String domain = body.get("domain");
        String state = body.getOrDefault("state", java.util.UUID.randomUUID().toString());
        String redirectUri = baseUrl + "/login?sso_callback=true";

        String authUrl = ssoService.buildAuthorizationUrl(domain, redirectUri, state);
        return ResponseEntity.ok(Map.of("authorizationUrl", authUrl, "state", state));
    }

    /**
     * SSO callback — exchange code for JWT tokens.
     */
    @PostMapping("/callback")
    public ResponseEntity<Map<String, Object>> callback(
            @RequestBody Map<String, String> body,
            HttpServletRequest request) {
        String domain = body.get("domain");
        String code = body.get("code");
        String redirectUri = baseUrl + "/login?sso_callback=true";
        String ipAddress = request.getRemoteAddr();

        Map<String, Object> result = ssoService.handleCallback(domain, code, redirectUri, ipAddress);
        return ResponseEntity.ok(result);
    }

    // ===== Admin endpoints (require auth + settings:write) =====

    @GetMapping("/config")
    @PreAuthorize("@perm.has(authentication, 'settings:read')")
    public ResponseEntity<?> getConfig(Authentication auth) {
        String companyId = authUtils.getCompanyId(auth);
        return ssoService.getConfig(companyId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.ok().build());
    }

    @PostMapping("/config")
    @PreAuthorize("@perm.has(authentication, 'settings:write')")
    public ResponseEntity<SsoConfiguration> saveConfig(
            Authentication auth,
            @RequestBody SsoConfiguration config) {
        String companyId = authUtils.getCompanyId(auth);
        return ResponseEntity.ok(ssoService.saveConfig(companyId, config));
    }

    @PostMapping("/config/toggle")
    @PreAuthorize("@perm.has(authentication, 'settings:write')")
    public ResponseEntity<SsoConfiguration> toggleSso(
            Authentication auth,
            @RequestBody Map<String, Boolean> body) {
        String companyId = authUtils.getCompanyId(auth);
        boolean active = body.getOrDefault("active", false);
        return ResponseEntity.ok(ssoService.toggleActive(companyId, active));
    }

    @DeleteMapping("/config")
    @PreAuthorize("@perm.has(authentication, 'settings:write')")
    public ResponseEntity<Void> deleteConfig(Authentication auth) {
        String companyId = authUtils.getCompanyId(auth);
        ssoService.deleteConfig(companyId);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/test")
    @PreAuthorize("@perm.has(authentication, 'settings:write')")
    public ResponseEntity<Map<String, Object>> testConnection(@RequestBody Map<String, String> body) {
        String issuerUrl = body.get("issuerUrl");
        return ResponseEntity.ok(ssoService.testConnection(issuerUrl));
    }
}
