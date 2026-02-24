package com.blackwolf.backend.controller;

import com.blackwolf.backend.model.BehaviorAnomaly;
import com.blackwolf.backend.model.EntityBehaviorProfile;
import com.blackwolf.backend.service.UebaService;
import com.blackwolf.backend.util.AuthUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/ueba")
public class UebaController {

    @Autowired
    private UebaService uebaService;

    @Autowired
    private AuthUtils authUtils;

    @GetMapping("/profiles")
    @PreAuthorize("@perm.has(authentication, 'threats:read')")
    public ResponseEntity<List<EntityBehaviorProfile>> getProfiles(Authentication authentication) {
        String companyId = authUtils.getCompanyId(authentication);
        return ResponseEntity.ok(uebaService.getProfiles(companyId));
    }

    @GetMapping("/anomalies")
    @PreAuthorize("@perm.has(authentication, 'threats:read')")
    public ResponseEntity<List<BehaviorAnomaly>> getAnomalies(Authentication authentication) {
        String companyId = authUtils.getCompanyId(authentication);
        return ResponseEntity.ok(uebaService.getAnomalies(companyId));
    }

    @PostMapping("/anomalies/{id}/review")
    @PreAuthorize("@perm.has(authentication, 'threats:read')")
    public ResponseEntity<BehaviorAnomaly> reviewAnomaly(
            Authentication authentication,
            @PathVariable String id) {
        String companyId = authUtils.getCompanyId(authentication);
        String reviewedBy = authUtils.getUserId(authentication);
        return ResponseEntity.ok(uebaService.reviewAnomaly(id, companyId, reviewedBy));
    }

    @GetMapping("/stats")
    @PreAuthorize("@perm.has(authentication, 'threats:read')")
    public ResponseEntity<Map<String, Object>> getDashboardStats(Authentication authentication) {
        String companyId = authUtils.getCompanyId(authentication);
        return ResponseEntity.ok(uebaService.getDashboardStats(companyId));
    }
}
