package com.blackwolf.backend.controller;

import com.blackwolf.backend.service.ReportService;
import com.blackwolf.backend.util.AuthUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/reports")
public class ReportController {

    @Autowired private ReportService reportService;
    @Autowired private AuthUtils authUtils;

    @GetMapping("/executive")
    public ResponseEntity<byte[]> executiveReport(Authentication auth) throws Exception {
        String companyId = authUtils.getCompanyId(auth);
        byte[] pdf = reportService.generateExecutiveReport(companyId);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=blackwolf-executive-report.pdf")
                .contentType(MediaType.APPLICATION_PDF)
                .body(pdf);
    }

    @GetMapping("/incident/{incidentId}")
    public ResponseEntity<byte[]> incidentReport(@PathVariable String incidentId) throws Exception {
        byte[] pdf = reportService.generateIncidentReport(incidentId);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=incident-report-" + incidentId + ".pdf")
                .contentType(MediaType.APPLICATION_PDF)
                .body(pdf);
    }

    @GetMapping("/threats/csv")
    public ResponseEntity<String> threatsCSV(Authentication auth) {
        String companyId = authUtils.getCompanyId(auth);
        String csv = reportService.exportThreatsCSV(companyId);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=threats-export.csv")
                .contentType(MediaType.parseMediaType("text/csv"))
                .body(csv);
    }

    @GetMapping("/incidents/csv")
    public ResponseEntity<String> incidentsCSV(Authentication auth) {
        String companyId = authUtils.getCompanyId(auth);
        String csv = reportService.exportIncidentsCSV(companyId);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=incidents-export.csv")
                .contentType(MediaType.parseMediaType("text/csv"))
                .body(csv);
    }
}
