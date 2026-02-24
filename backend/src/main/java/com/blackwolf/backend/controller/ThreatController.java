package com.blackwolf.backend.controller;

import com.blackwolf.backend.dto.ThreatDTOs.*;
import com.blackwolf.backend.model.ThreatEnrichment;
import com.blackwolf.backend.model.ThreatEvent;
import com.blackwolf.backend.service.ThreatIntelService;
import com.blackwolf.backend.service.ThreatService;
import com.blackwolf.backend.util.AuthUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/threats")
public class ThreatController {

    @Autowired
    private ThreatService threatService;

    @Autowired
    private ThreatIntelService threatIntelService;

    @Autowired
    private AuthUtils authUtils;

    @GetMapping
    @PreAuthorize("@perm.has(authentication, 'threats:read')")
    public ResponseEntity<ThreatListResponse> listThreats(
            Authentication authentication,
            @RequestParam(required = false) String threatType,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) Integer minSeverity,
            @RequestParam(required = false) Integer maxSeverity,
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "timestamp") String sortBy,
            @RequestParam(defaultValue = "desc") String sortDir) {

        String companyId = authUtils.getCompanyId(authentication);

        ThreatFilterRequest filter = new ThreatFilterRequest();
        filter.setThreatType(threatType);
        filter.setStatus(status);
        filter.setMinSeverity(minSeverity);
        filter.setMaxSeverity(maxSeverity);
        filter.setSearch(search);
        filter.setPage(page);
        filter.setSize(size);
        filter.setSortBy(sortBy);
        filter.setSortDir(sortDir);

        return ResponseEntity.ok(threatService.getThreats(companyId, filter));
    }

    @GetMapping("/map-origins")
    @PreAuthorize("@perm.has(authentication, 'threats:read')")
    public ResponseEntity<List<Map<String, Object>>> getMapOrigins(Authentication authentication) {
        String companyId = authUtils.getCompanyId(authentication);
        return ResponseEntity.ok(threatService.getMapOrigins(companyId));
    }

    @PatchMapping("/{id}/status")
    @PreAuthorize("@perm.has(authentication, 'threats:write')")
    public ResponseEntity<ThreatEvent> updateStatus(
            Authentication authentication,
            @PathVariable String id,
            @RequestBody UpdateThreatStatusRequest request) {
        String companyId = authUtils.getCompanyId(authentication);
        return ResponseEntity.ok(threatService.updateStatus(id, companyId, request.getStatus()));
    }

    @GetMapping("/enrichment/{ip}")
    @PreAuthorize("@perm.has(authentication, 'threats:read')")
    public ResponseEntity<ThreatEnrichment> getEnrichment(@PathVariable String ip) {
        return threatIntelService.getEnrichment(ip)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/enrich/{ip}")
    @PreAuthorize("@perm.has(authentication, 'threats:write')")
    public ResponseEntity<ThreatEnrichment> enrichIp(@PathVariable String ip) {
        return ResponseEntity.ok(threatIntelService.enrichIp(ip));
    }
}
