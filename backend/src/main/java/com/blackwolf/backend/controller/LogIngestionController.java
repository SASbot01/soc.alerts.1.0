package com.blackwolf.backend.controller;

import com.blackwolf.backend.model.LogSource;
import com.blackwolf.backend.service.LogIngestionService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/logs")
@RequiredArgsConstructor
public class LogIngestionController {

    private final LogIngestionService logIngestionService;

    @PostMapping("/ingest")
    public ResponseEntity<?> ingestLog(
            @RequestParam String companyId,
            @RequestBody Map<String, Object> logData) {
        return ResponseEntity.ok(logIngestionService.ingestLog(companyId, logData));
    }

    @GetMapping("/search")
    public ResponseEntity<?> searchLogs(
            @RequestParam String companyId,
            @RequestParam(required = false) String query,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime to,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {
        return ResponseEntity.ok(logIngestionService.searchLogs(companyId, query, from, to, PageRequest.of(page, size)));
    }

    @GetMapping("/sources")
    public ResponseEntity<?> getLogSources(@RequestParam String companyId) {
        return ResponseEntity.ok(logIngestionService.getLogSources(companyId));
    }

    @PostMapping("/sources")
    public ResponseEntity<?> addLogSource(
            @RequestParam String companyId,
            @RequestBody LogSource logSource) {
        return ResponseEntity.ok(logIngestionService.addLogSource(companyId, logSource));
    }

    @GetMapping("/stats")
    public ResponseEntity<?> getStats(@RequestParam String companyId) {
        return ResponseEntity.ok(logIngestionService.getStats(companyId));
    }
}
