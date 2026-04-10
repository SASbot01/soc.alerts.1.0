package com.blackwolf.backend.controller;

import com.blackwolf.backend.model.IocEntry;
import com.blackwolf.backend.model.StixFeed;
import com.blackwolf.backend.service.ThreatIntelPlatformService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/threat-intel")
@RequiredArgsConstructor
public class ThreatIntelController {

    private final ThreatIntelPlatformService threatIntelPlatformService;

    @GetMapping("/iocs")
    public ResponseEntity<?> getIocs(
            @RequestParam String companyId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {
        return ResponseEntity.ok(threatIntelPlatformService.getIocs(companyId, PageRequest.of(page, size)));
    }

    @PostMapping("/iocs")
    public ResponseEntity<?> addIoc(
            @RequestParam String companyId,
            @RequestBody IocEntry iocEntry) {
        return ResponseEntity.ok(threatIntelPlatformService.addIoc(companyId, iocEntry));
    }

    @GetMapping("/iocs/check")
    public ResponseEntity<?> checkIoc(
            @RequestParam String value,
            @RequestParam String type) {
        return ResponseEntity.ok(threatIntelPlatformService.checkIoc(value, type));
    }

    @GetMapping("/feeds")
    public ResponseEntity<?> getFeeds(@RequestParam String companyId) {
        return ResponseEntity.ok(threatIntelPlatformService.getFeeds(companyId));
    }

    @PostMapping("/feeds")
    public ResponseEntity<?> addFeed(
            @RequestParam String companyId,
            @RequestBody StixFeed stixFeed) {
        return ResponseEntity.ok(threatIntelPlatformService.addFeed(companyId, stixFeed));
    }

    @DeleteMapping("/feeds/{id}")
    public ResponseEntity<?> deleteFeed(@PathVariable Long id) {
        threatIntelPlatformService.deleteFeed(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/stats")
    public ResponseEntity<?> getFeedStats(@RequestParam String companyId) {
        return ResponseEntity.ok(threatIntelPlatformService.getFeedStats(companyId));
    }
}
