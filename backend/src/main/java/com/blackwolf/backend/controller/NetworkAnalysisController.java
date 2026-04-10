package com.blackwolf.backend.controller;

import com.blackwolf.backend.model.NetworkFlow;
import com.blackwolf.backend.service.NetworkAnalysisService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;

@RestController
@RequestMapping("/api/v1/network")
@RequiredArgsConstructor
public class NetworkAnalysisController {

    private final NetworkAnalysisService networkAnalysisService;

    @PostMapping("/flows")
    public ResponseEntity<?> ingestFlow(
            @RequestParam String companyId,
            @RequestBody NetworkFlow flow) {
        return ResponseEntity.ok(networkAnalysisService.ingestFlow(companyId, flow));
    }

    @GetMapping("/flows")
    public ResponseEntity<?> getFlows(
            @RequestParam String companyId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime to,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {
        return ResponseEntity.ok(networkAnalysisService.getFlows(companyId, from, to, PageRequest.of(page, size)));
    }

    @GetMapping("/threats")
    public ResponseEntity<?> getThreats(
            @RequestParam String companyId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {
        return ResponseEntity.ok(networkAnalysisService.getThreats(companyId, PageRequest.of(page, size)));
    }

    @GetMapping("/top-talkers")
    public ResponseEntity<?> getTopTalkers(
            @RequestParam String companyId,
            @RequestParam(defaultValue = "10") int limit) {
        return ResponseEntity.ok(networkAnalysisService.getTopTalkers(companyId, limit));
    }

    @GetMapping("/protocols")
    public ResponseEntity<?> getProtocolDistribution(@RequestParam String companyId) {
        return ResponseEntity.ok(networkAnalysisService.getProtocolDistribution(companyId));
    }

    @GetMapping("/stats")
    public ResponseEntity<?> getStats(@RequestParam String companyId) {
        return ResponseEntity.ok(networkAnalysisService.getStats(companyId));
    }
}
