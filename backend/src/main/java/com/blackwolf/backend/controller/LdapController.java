package com.blackwolf.backend.controller;

import com.blackwolf.backend.dto.InfrastructureDTOs.*;
import com.blackwolf.backend.model.LdapSyncLog;
import com.blackwolf.backend.service.LdapService;
import com.blackwolf.backend.util.AuthUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/ldap")
public class LdapController {

    @Autowired
    private LdapService ldapService;

    @Autowired
    private AuthUtils authUtils;

    @GetMapping("/config")
    @PreAuthorize("@perm.has(authentication, 'settings:read')")
    public ResponseEntity<LdapConfig> getConfig(Authentication auth) {
        String companyId = authUtils.getCompanyId(auth);
        return ResponseEntity.ok(ldapService.getConfig(companyId));
    }

    @PostMapping("/users/bulk")
    @PreAuthorize("@perm.has(authentication, 'users:write')")
    public ResponseEntity<LdapSyncResponse> createUsers(Authentication auth, @RequestBody LdapBulkCreateRequest request) {
        String companyId = authUtils.getCompanyId(auth);
        String performedBy = authUtils.getUser(auth).getEmail();
        return ResponseEntity.ok(ldapService.createUsers(companyId, request, performedBy));
    }

    @GetMapping("/sync-logs")
    @PreAuthorize("@perm.has(authentication, 'settings:read')")
    public ResponseEntity<List<LdapSyncLog>> getSyncLogs(Authentication auth) {
        String companyId = authUtils.getCompanyId(auth);
        return ResponseEntity.ok(ldapService.getSyncLogs(companyId));
    }
}
