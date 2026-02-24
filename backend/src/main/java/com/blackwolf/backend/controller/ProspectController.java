package com.blackwolf.backend.controller;

import com.blackwolf.backend.model.Prospect;
import com.blackwolf.backend.repository.ProspectRepository;
import com.blackwolf.backend.service.SalesOutreachBot;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Base64;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/prospects")
public class ProspectController {

    @Autowired private SalesOutreachBot outreachBot;
    @Autowired private ProspectRepository prospectRepository;

    @Value("${prospector.api-key:}")
    private String prospectorApiKey;

    // Public endpoint for LinkedIn prospector bot — validates via API key header
    @PostMapping("/from-bot")
    public ResponseEntity<?> fromBot(@RequestHeader(value = "X-Prospector-Key", required = false) String apiKey,
                                     @RequestBody Map<String, String> body) {
        if (prospectorApiKey == null || prospectorApiKey.isBlank() || !prospectorApiKey.equals(apiKey)) {
            return ResponseEntity.status(403).body(Map.of("error", "Invalid or missing API key"));
        }
        Prospect prospect = outreachBot.addProspect(
                body.get("email"),
                body.getOrDefault("companyName", null),
                body.getOrDefault("domain", null),
                body.getOrDefault("contactName", null),
                body.getOrDefault("source", "linkedin"),
                body.getOrDefault("tags", null));
        return ResponseEntity.ok(prospect);
    }

    // Add a single prospect
    @PostMapping
    public ResponseEntity<?> addProspect(@RequestBody Map<String, String> body) {
        Prospect prospect = outreachBot.addProspect(
                body.get("email"),
                body.getOrDefault("companyName", null),
                body.getOrDefault("domain", null),
                body.getOrDefault("contactName", null),
                body.getOrDefault("source", "manual"),
                body.getOrDefault("tags", null));
        return ResponseEntity.ok(prospect);
    }

    // Bulk import prospects
    @PostMapping("/import")
    public ResponseEntity<?> importProspects(@RequestBody Map<String, Object> body) {
        @SuppressWarnings("unchecked")
        List<Map<String, String>> prospects = (List<Map<String, String>>) body.get("prospects");
        String source = (String) body.getOrDefault("source", "manual");
        return ResponseEntity.ok(outreachBot.importProspects(prospects, source));
    }

    // List all prospects
    @GetMapping
    public ResponseEntity<?> listProspects() {
        return ResponseEntity.ok(prospectRepository.findAllByOrderByCreatedAtDesc());
    }

    // Get outreach stats
    @GetMapping("/stats")
    public ResponseEntity<?> getStats() {
        return ResponseEntity.ok(outreachBot.getStats());
    }

    // Force send next email to a specific prospect (for testing)
    @PostMapping("/{id}/send-now")
    public ResponseEntity<?> sendNow(@PathVariable String id) {
        try {
            return ResponseEntity.ok(outreachBot.sendNow(id));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    // Trigger daily outreach manually (for testing)
    @PostMapping("/trigger-daily")
    public ResponseEntity<?> triggerDaily() {
        outreachBot.runDailyOutreach();
        return ResponseEntity.ok(Map.of("status", "daily outreach triggered"));
    }

    // Trigger self-improvement analysis manually
    @PostMapping("/trigger-improve")
    public ResponseEntity<?> triggerImprove() {
        outreachBot.selfImprove();
        return ResponseEntity.ok(Map.of("status", "self-improvement analysis triggered"));
    }

    // Unsubscribe a prospect
    @PostMapping("/unsubscribe")
    public ResponseEntity<?> unsubscribe(@RequestParam String email) {
        outreachBot.unsubscribe(email);
        return ResponseEntity.ok(Map.of("status", "unsubscribed", "email", email));
    }

    // Track open (called via email tracking pixel)
    @GetMapping("/track/open/{prospectId}")
    public ResponseEntity<byte[]> trackOpen(@PathVariable String prospectId) {
        outreachBot.recordOpen(prospectId);
        // Return 1x1 transparent pixel
        byte[] pixel = Base64.getDecoder().decode(
                "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7");
        return ResponseEntity.ok()
                .header("Content-Type", "image/gif")
                .header("Cache-Control", "no-store, no-cache")
                .body(pixel);
    }

    // Track click (redirects to landing)
    @GetMapping("/track/click/{prospectId}")
    public ResponseEntity<?> trackClick(@PathVariable String prospectId) {
        outreachBot.recordClick(prospectId);
        return ResponseEntity.status(302)
                .header("Location", "https://soc.blackwolfsec.io/landing")
                .build();
    }
}
