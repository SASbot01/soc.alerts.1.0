package com.blackwolf.backend.controller;

import com.blackwolf.backend.dto.MitreDTOs.*;
import com.blackwolf.backend.model.MitreTechnique;
import com.blackwolf.backend.model.ThreatMitreMapping;
import com.blackwolf.backend.service.MitreService;
import com.blackwolf.backend.util.AuthUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/mitre")
public class MitreController {

    @Autowired
    private MitreService mitreService;

    @Autowired
    private AuthUtils authUtils;

    @GetMapping("/techniques")
    public ResponseEntity<List<MitreTechnique>> listTechniques() {
        return ResponseEntity.ok(mitreService.listAll());
    }

    @GetMapping("/threat/{threatId}/mappings")
    public ResponseEntity<List<MitreMappingResponse>> getMappings(@PathVariable String threatId) {
        return ResponseEntity.ok(mitreService.getMappingsForThreat(threatId));
    }

    @PostMapping("/threat/{threatId}/map")
    public ResponseEntity<ThreatMitreMapping> mapThreat(
            Authentication auth,
            @PathVariable String threatId,
            @RequestBody MapThreatRequest request) {
        authUtils.getCompanyId(auth);
        return ResponseEntity.ok(mitreService.mapThreatToTechnique(
                threatId, request.getTechniqueId(), request.getConfidence()));
    }

    @GetMapping("/coverage")
    public ResponseEntity<List<MitreCoverageResponse>> getCoverage(Authentication auth) {
        String companyId = authUtils.getCompanyId(auth);
        return ResponseEntity.ok(mitreService.getCoverage(companyId));
    }

    @GetMapping("/incident/{incidentId}/mappings")
    public ResponseEntity<List<MitreMappingResponse>> getIncidentMappings(@PathVariable String incidentId) {
        return ResponseEntity.ok(mitreService.getMappingsForIncident(incidentId));
    }
}
