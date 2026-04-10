package com.blackwolf.backend.controller;

import com.blackwolf.backend.model.HoneyEvent;
import com.blackwolf.backend.model.HoneyToken;
import com.blackwolf.backend.service.DeceptionService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/deception")
@RequiredArgsConstructor
public class DeceptionController {

    private final DeceptionService deceptionService;

    @GetMapping("/tokens")
    public ResponseEntity<?> getTokens(@RequestParam String companyId) {
        return ResponseEntity.ok(deceptionService.getTokens(companyId));
    }

    @PostMapping("/tokens")
    public ResponseEntity<?> createToken(
            @RequestParam String companyId,
            @RequestBody HoneyToken token) {
        return ResponseEntity.ok(deceptionService.createToken(companyId, token));
    }

    @PostMapping("/tokens/{id}/deactivate")
    public ResponseEntity<?> deactivateToken(@PathVariable Long id) {
        return ResponseEntity.ok(deceptionService.deactivateToken(id));
    }

    @PostMapping("/tokens/{tokenId}/hit")
    public ResponseEntity<?> recordHit(
            @PathVariable Long tokenId,
            @RequestBody HoneyEvent event) {
        return ResponseEntity.ok(deceptionService.recordHit(tokenId, event));
    }

    @GetMapping("/tokens/{tokenId}/events")
    public ResponseEntity<?> getEvents(@PathVariable Long tokenId) {
        return ResponseEntity.ok(deceptionService.getEvents(tokenId));
    }

    @GetMapping("/stats")
    public ResponseEntity<?> getStats(@RequestParam String companyId) {
        return ResponseEntity.ok(deceptionService.getStats(companyId));
    }
}
