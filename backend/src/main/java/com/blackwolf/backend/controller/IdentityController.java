package com.blackwolf.backend.controller;

import com.blackwolf.backend.model.IdentityEvent;
import com.blackwolf.backend.service.IdentityThreatService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;

@RestController
@RequestMapping("/api/v1/identity")
@RequiredArgsConstructor
public class IdentityController {

    private final IdentityThreatService identityThreatService;

    @PostMapping("/events")
    public ResponseEntity<?> recordEvent(
            @RequestParam String companyId,
            @RequestBody IdentityEvent event) {
        return ResponseEntity.ok(identityThreatService.recordEvent(companyId, event));
    }

    @GetMapping("/events")
    public ResponseEntity<?> getEvents(
            @RequestParam String companyId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime to,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {
        return ResponseEntity.ok(identityThreatService.getEvents(companyId, from, to, PageRequest.of(page, size)));
    }

    @GetMapping("/users/{username}/activity")
    public ResponseEntity<?> getUserActivity(
            @PathVariable String username,
            @RequestParam String companyId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {
        return ResponseEntity.ok(identityThreatService.getUserActivity(companyId, username, PageRequest.of(page, size)));
    }

    @GetMapping("/stats")
    public ResponseEntity<?> getStats(@RequestParam String companyId) {
        return ResponseEntity.ok(identityThreatService.getStats(companyId));
    }
}
