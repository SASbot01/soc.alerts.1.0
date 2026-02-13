package com.blackwolf.backend.controller;

import com.blackwolf.backend.dto.SensorDTOs.*;
import com.blackwolf.backend.model.Sensor;
import com.blackwolf.backend.repository.SensorRepository;
import com.blackwolf.backend.service.SensorService;
import com.blackwolf.backend.util.AuthUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/sensors")
public class SensorController {

    @Autowired
    private SensorService sensorService;

    @Autowired
    private SensorRepository sensorRepository;

    @Autowired
    private AuthUtils authUtils;

    @PostMapping("/upload")
    public ResponseEntity<SensorResponse> upload(@RequestBody SensorDataUpload upload) {
        return ResponseEntity.ok(sensorService.processUpload(upload));
    }

    @GetMapping
    public ResponseEntity<List<Sensor>> listSensors(Authentication authentication) {
        String companyId = authUtils.getCompanyId(authentication);
        List<Sensor> sensors = sensorRepository.findByCompanyId(companyId);
        return ResponseEntity.ok(sensors);
    }

    @GetMapping("/{id}")
    public ResponseEntity<SensorDetailResponse> getDetail(Authentication auth, @PathVariable String id) {
        return ResponseEntity.ok(sensorService.getSensorDetail(id, authUtils.getCompanyId(auth)));
    }

    // ===== Sensor Catalog =====

    @GetMapping("/catalog")
    public ResponseEntity<List<SensorTemplateResponse>> listCatalog(Authentication auth) {
        return ResponseEntity.ok(sensorService.listTemplates(authUtils.getCompanyId(auth)));
    }

    @PostMapping("/catalog/deploy")
    public ResponseEntity<Sensor> deploySensor(Authentication auth, @RequestBody DeploySensorRequest request) {
        String companyId = authUtils.getCompanyId(auth);
        String performedBy = authUtils.getUser(auth).getEmail();
        return ResponseEntity.ok(sensorService.deploySensor(companyId, request, performedBy));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Map<String, String>> removeSensor(Authentication auth, @PathVariable String id) {
        String companyId = authUtils.getCompanyId(auth);
        String performedBy = authUtils.getUser(auth).getEmail();
        sensorService.removeSensor(id, companyId, performedBy);
        return ResponseEntity.ok(Map.of("status", "removed"));
    }

    // ===== Assignments =====

    @PostMapping("/assignments")
    public ResponseEntity<AssetSensorAssignmentResponse> assign(Authentication auth, @RequestBody AssignSensorRequest request) {
        String companyId = authUtils.getCompanyId(auth);
        String performedBy = authUtils.getUser(auth).getEmail();
        return ResponseEntity.ok(sensorService.assignToAsset(companyId, request, performedBy));
    }

    @PostMapping("/assignments/bulk")
    public ResponseEntity<List<AssetSensorAssignmentResponse>> bulkAssign(Authentication auth, @RequestBody BulkAssignSensorRequest request) {
        String companyId = authUtils.getCompanyId(auth);
        String performedBy = authUtils.getUser(auth).getEmail();
        return ResponseEntity.ok(sensorService.bulkAssign(companyId, request, performedBy));
    }

    @DeleteMapping("/assignments/{sensorId}/{assetId}")
    public ResponseEntity<Map<String, String>> unassign(Authentication auth,
            @PathVariable String sensorId, @PathVariable String assetId) {
        String companyId = authUtils.getCompanyId(auth);
        String performedBy = authUtils.getUser(auth).getEmail();
        sensorService.unassignFromAsset(companyId, sensorId, assetId, performedBy);
        return ResponseEntity.ok(Map.of("status", "unassigned"));
    }

    @GetMapping("/{id}/assignments")
    public ResponseEntity<List<AssetSensorAssignmentResponse>> getSensorAssignments(Authentication auth, @PathVariable String id) {
        return ResponseEntity.ok(sensorService.getSensorAssignments(id, authUtils.getCompanyId(auth)));
    }
}
