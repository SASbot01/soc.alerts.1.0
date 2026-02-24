package com.blackwolf.backend.controller;

import com.blackwolf.backend.model.HuntResult;
import com.blackwolf.backend.model.SavedHunt;
import com.blackwolf.backend.util.AuthUtils;
import com.blackwolf.backend.service.ThreatHuntingService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/hunting")
public class ThreatHuntingController {

    @Autowired
    private ThreatHuntingService huntingService;

    @Autowired
    private AuthUtils authUtils;

    @GetMapping
    @PreAuthorize("@perm.has(authentication, 'threats:read')")
    public ResponseEntity<List<SavedHunt>> listHunts(Authentication auth) {
        return ResponseEntity.ok(huntingService.listHunts(authUtils.getCompanyId(auth)));
    }

    @GetMapping("/{id}")
    @PreAuthorize("@perm.has(authentication, 'threats:read')")
    public ResponseEntity<SavedHunt> getHunt(@PathVariable String id, Authentication auth) {
        return ResponseEntity.ok(huntingService.getHunt(id, authUtils.getCompanyId(auth)));
    }

    @PostMapping
    @PreAuthorize("@perm.has(authentication, 'threats:write')")
    public ResponseEntity<SavedHunt> createHunt(@RequestBody Map<String, Object> request, Authentication auth) {
        return ResponseEntity.ok(huntingService.createHunt(authUtils.getCompanyId(auth), request, authUtils.getUserId(auth)));
    }

    @PutMapping("/{id}")
    @PreAuthorize("@perm.has(authentication, 'threats:write')")
    public ResponseEntity<SavedHunt> updateHunt(@PathVariable String id, @RequestBody Map<String, Object> request, Authentication auth) {
        return ResponseEntity.ok(huntingService.updateHunt(id, authUtils.getCompanyId(auth), request, authUtils.getUserId(auth)));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("@perm.has(authentication, 'threats:delete')")
    public ResponseEntity<Void> deleteHunt(@PathVariable String id, Authentication auth) {
        huntingService.deleteHunt(id, authUtils.getCompanyId(auth), authUtils.getUserId(auth));
        return ResponseEntity.ok().build();
    }

    @PostMapping("/{id}/execute")
    @PreAuthorize("@perm.has(authentication, 'threats:execute')")
    public ResponseEntity<Map<String, Object>> executeHunt(@PathVariable String id, Authentication auth) {
        return ResponseEntity.ok(huntingService.executeHunt(id, authUtils.getCompanyId(auth), authUtils.getUserId(auth)));
    }

    @PostMapping("/search")
    @PreAuthorize("@perm.has(authentication, 'threats:read')")
    public ResponseEntity<Map<String, Object>> quickSearch(@RequestBody Map<String, Object> query, Authentication auth) {
        return ResponseEntity.ok(huntingService.quickSearch(authUtils.getCompanyId(auth), query));
    }

    @GetMapping("/aggregations")
    @PreAuthorize("@perm.has(authentication, 'threats:read')")
    public ResponseEntity<Map<String, Object>> getAggregations(
            @RequestParam String field,
            @RequestParam(defaultValue = "24h") String timeRange,
            Authentication auth) {
        return ResponseEntity.ok(huntingService.getAggregations(authUtils.getCompanyId(auth), field, timeRange));
    }

    @GetMapping("/{id}/history")
    @PreAuthorize("@perm.has(authentication, 'threats:read')")
    public ResponseEntity<List<HuntResult>> getHuntHistory(@PathVariable String id, Authentication auth) {
        return ResponseEntity.ok(huntingService.getHuntHistory(id, authUtils.getCompanyId(auth)));
    }
}
