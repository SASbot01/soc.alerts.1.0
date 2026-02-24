package com.blackwolf.backend.controller;

import com.blackwolf.backend.model.SigmaRule;
import com.blackwolf.backend.util.AuthUtils;
import com.blackwolf.backend.service.SigmaRuleService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/sigma")
public class SigmaController {

    @Autowired
    private SigmaRuleService sigmaRuleService;

    @Autowired
    private AuthUtils authUtils;

    @GetMapping
    @PreAuthorize("@perm.has(authentication, 'threats:read')")
    public ResponseEntity<List<SigmaRule>> listRules(Authentication auth) {
        return ResponseEntity.ok(sigmaRuleService.listByCompany(authUtils.getCompanyId(auth)));
    }

    @GetMapping("/global")
    @PreAuthorize("@perm.has(authentication, 'threats:read')")
    public ResponseEntity<List<SigmaRule>> listGlobalRules() {
        return ResponseEntity.ok(sigmaRuleService.listGlobal());
    }

    @GetMapping("/{id}")
    @PreAuthorize("@perm.has(authentication, 'threats:read')")
    public ResponseEntity<SigmaRule> getRule(@PathVariable String id) {
        return ResponseEntity.ok(sigmaRuleService.getById(id));
    }

    @PostMapping
    @PreAuthorize("@perm.has(authentication, 'threats:write')")
    public ResponseEntity<SigmaRule> createRule(@RequestBody Map<String, Object> request, Authentication auth) {
        return ResponseEntity.ok(sigmaRuleService.create(authUtils.getCompanyId(auth), request, authUtils.getUserId(auth)));
    }

    @PutMapping("/{id}")
    @PreAuthorize("@perm.has(authentication, 'threats:write')")
    public ResponseEntity<SigmaRule> updateRule(@PathVariable String id, @RequestBody Map<String, Object> request, Authentication auth) {
        return ResponseEntity.ok(sigmaRuleService.update(id, authUtils.getCompanyId(auth), request, authUtils.getUserId(auth)));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("@perm.has(authentication, 'threats:delete')")
    public ResponseEntity<Void> deleteRule(@PathVariable String id, Authentication auth) {
        sigmaRuleService.delete(id, authUtils.getCompanyId(auth), authUtils.getUserId(auth));
        return ResponseEntity.ok().build();
    }

    @PostMapping("/{id}/toggle")
    @PreAuthorize("@perm.has(authentication, 'threats:write')")
    public ResponseEntity<SigmaRule> toggleRule(@PathVariable String id, Authentication auth) {
        return ResponseEntity.ok(sigmaRuleService.toggleEnabled(id, authUtils.getCompanyId(auth)));
    }

    @GetMapping("/stats")
    @PreAuthorize("@perm.has(authentication, 'threats:read')")
    public ResponseEntity<Map<String, Object>> getStats(Authentication auth) {
        return ResponseEntity.ok(sigmaRuleService.getStats(authUtils.getCompanyId(auth)));
    }
}
