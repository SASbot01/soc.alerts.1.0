package com.blackwolf.backend.service;

import com.blackwolf.backend.dto.SensorDTOs.*;
import com.blackwolf.backend.model.*;
import com.blackwolf.backend.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class SensorService {

    @Autowired
    private CompanyRepository companyRepository;

    @Autowired
    private SensorRepository sensorRepository;

    @Autowired
    private ThreatEventRepository threatEventRepository;

    @Autowired
    private BlockedIPRepository blockedIPRepository;

    @Autowired
    private BlockedSubnetRepository blockedSubnetRepository;

    @Autowired
    private CorrelationService correlationService;

    @Autowired
    private AlertService alertService;

    @Autowired
    private ThreatIntelService threatIntelService;

    @Autowired
    private SseService sseService;

    @Autowired
    private PlaybookService playbookService;

    @Autowired
    private MitreService mitreService;

    @Autowired
    private AssetSensorAssignmentRepository assignmentRepository;

    @Autowired
    private AssetRepository assetRepository;

    @Autowired
    private ActivityLogService activityLogService;

    @Autowired
    private AiAutonomousAgentService aiAutonomousAgentService;

    @Autowired
    private ApiKeyService apiKeyService;

    @Autowired
    private ThreatIndexService threatIndexService;

    @Autowired
    private SigmaRuleService sigmaRuleService;

    @Autowired
    private UebaService uebaService;

    // ===== Upload Processing (unchanged) =====

    @Transactional
    public SensorResponse processUpload(SensorDataUpload upload) {
        // Validate API key via api_keys table (SHA-256 hash lookup)
        Optional<String> validatedCompanyId = apiKeyService.validateKey(upload.getApi_key());
        if (validatedCompanyId.isEmpty() || !validatedCompanyId.get().equals(upload.getCompany_id())) {
            // Fallback: check legacy companies.api_key for backward compatibility
            Optional<Company> company = companyRepository.findByApiKey(upload.getApi_key());
            if (company.isEmpty() || !company.get().getId().equals(upload.getCompany_id())) {
                throw new RuntimeException("Invalid API key or company mismatch");
            }
        }

        // Update Sensor
        Sensor sensor = sensorRepository.findById(upload.getSensor_id()).orElse(new Sensor());
        sensor.setId(upload.getSensor_id());
        sensor.setCompanyId(upload.getCompany_id());
        sensor.setLastSeen(LocalDateTime.now());
        sensor.setStatus("online");
        if (sensor.getPacketsProcessed() == null)
            sensor.setPacketsProcessed(0L);
        if (sensor.getThreatsDetected() == null)
            sensor.setThreatsDetected(0L);

        if (upload.getPackets() != null) {
            sensor.setPacketsProcessed(sensor.getPacketsProcessed() + upload.getPackets().size());
        }
        if (upload.getThreats() != null) {
            sensor.setThreatsDetected(sensor.getThreatsDetected() + upload.getThreats().size());
        }
        sensorRepository.save(sensor);

        // Process Threats
        List<ThreatInfo> threats = upload.getThreats();
        if (threats != null) {
            // Load active blocked subnets once for this upload batch
            List<BlockedSubnet> activeSubnets = blockedSubnetRepository.findActiveByCompanyId(
                    upload.getCompany_id(), LocalDateTime.now());

            // Dedup window: suppress duplicate alerts from same IP+type within 30 minutes
            LocalDateTime dedupSince = LocalDateTime.now().minusMinutes(30);

            for (ThreatInfo t : threats) {
                // Subnet block check: skip processing if source IP is in a blocked subnet
                if (t.getSrc_ip() != null && isIpInBlockedSubnet(t.getSrc_ip(), activeSubnets)) {
                    ThreatEvent event = new ThreatEvent();
                    event.setId(UUID.randomUUID().toString());
                    event.setCompanyId(upload.getCompany_id());
                    event.setSensorId(upload.getSensor_id());
                    event.setThreatType(t.getThreat_type());
                    event.setSeverity(t.getSeverity());
                    event.setSrcIp(t.getSrc_ip());
                    event.setDstIp(t.getDst_ip());
                    event.setDstPort(t.getDst_port());
                    event.setTimestamp(LocalDateTime.now());
                    event.setStatus("blocked_subnet");
                    event.setDescription(t.getDescription());
                    threatEventRepository.save(event);
                    continue;
                }

                // Temporal deduplication: skip if we already have recent events from same IP+type
                if (t.getSrc_ip() != null && t.getThreat_type() != null) {
                    long recentCount = threatEventRepository.countRecentDuplicates(
                            upload.getCompany_id(), t.getSrc_ip(), t.getThreat_type(), dedupSince);
                    if (recentCount >= 5) {
                        // Still save the event for historical record, but skip alerts/correlation
                        ThreatEvent event = new ThreatEvent();
                        event.setId(UUID.randomUUID().toString());
                        event.setCompanyId(upload.getCompany_id());
                        event.setSensorId(upload.getSensor_id());
                        event.setThreatType(t.getThreat_type());
                        event.setSeverity(t.getSeverity());
                        event.setSrcIp(t.getSrc_ip());
                        event.setDstIp(t.getDst_ip());
                        event.setDstPort(t.getDst_port());
                        event.setTimestamp(LocalDateTime.now());
                        event.setStatus("suppressed");
                        event.setDescription(t.getDescription());
                        threatEventRepository.save(event);
                        continue;
                    }
                }

                ThreatEvent event = new ThreatEvent();
                event.setId(UUID.randomUUID().toString());
                event.setCompanyId(upload.getCompany_id());
                event.setSensorId(upload.getSensor_id());
                event.setThreatType(t.getThreat_type());
                event.setSeverity(t.getSeverity());
                event.setSrcIp(t.getSrc_ip());
                event.setDstIp(t.getDst_ip());
                event.setDstPort(t.getDst_port());
                event.setTimestamp(LocalDateTime.now());
                event.setStatus("detected");
                event.setDescription(t.getDescription());

                threatEventRepository.save(event);

                try {
                    correlationService.evaluateThreat(event);
                    // Per-threat email/slack alerts disabled — too noisy and costs SMTP credits.
                    // Alerts are sent only for incidents (correlated, important events).
                    sseService.emitThreat(event);
                    playbookService.triggerForThreat(event);
                    mitreService.autoMapThreat(event.getId(), event.getCompanyId());
                    if (t.getSrc_ip() != null) {
                        threatIntelService.enrichIp(t.getSrc_ip());
                    }
                } catch (Exception e) {
                    // Don't fail the upload if enrichment/correlation/SSE/SOAR fails
                }

                // Index in Elasticsearch for fast search
                try {
                    threatIndexService.indexThreatEvent(event);
                } catch (Exception e) {
                    // Don't fail upload if ES indexing fails
                }

                // Evaluate SIGMA rules
                try {
                    sigmaRuleService.evaluateEvent(event);
                } catch (Exception e) {
                    // Don't fail upload if SIGMA evaluation fails
                }

                // UEBA behavioral analysis
                try {
                    uebaService.evaluateEvent(event);
                } catch (Exception e) {
                    // Don't fail upload if UEBA fails
                }

                // Queue for autonomous AI analysis
                try {
                    aiAutonomousAgentService.queueThreat(event);
                } catch (Exception e) {
                    // Don't fail upload if AI agent has issues
                }

                // Auto Block logic (threshold raised to severity >= 7 to reduce false positives)
                if (t.getSeverity() != null && t.getSeverity() >= 7) {
                    BlockedIPId id = new BlockedIPId();
                    id.setIp(t.getSrc_ip());
                    id.setCompanyId(upload.getCompany_id());

                    if (!blockedIPRepository.existsById(id)) {
                        try {
                            BlockedIP blocked = new BlockedIP();
                            blocked.setIp(t.getSrc_ip());
                            blocked.setCompanyId(upload.getCompany_id());
                            blocked.setReason("Auto-block: " + t.getThreat_type());
                            blocked.setBlockedAt(LocalDateTime.now());
                            blocked.setExpiresAt(LocalDateTime.now().plusHours(24));
                            blockedIPRepository.save(blocked);
                        } catch (org.springframework.dao.DataIntegrityViolationException ignored) {
                            // IP already blocked by concurrent thread
                        }
                    }

                    // Auto-subnet-blocking: if ≥3 IPs from same /24 are individually blocked, block the subnet
                    try {
                        autoBlockSubnetIfNeeded(upload.getCompany_id(), t.getSrc_ip());
                    } catch (Exception ignored) {}
                }
            }
        }

        // Get Commands (Blocked IPs + Blocked Subnets - only active, non-expired)
        List<BlockedIP> blockedIPs = blockedIPRepository.findActiveByCompanyId(upload.getCompany_id(), LocalDateTime.now());
        List<Command> commands = new ArrayList<>(blockedIPs.stream()
                .map(b -> new Command("block_ip", b.getIp(), b.getReason()))
                .collect(Collectors.toList()));

        // Include subnet block commands
        List<BlockedSubnet> blockedSubnets = blockedSubnetRepository.findActiveByCompanyId(
                upload.getCompany_id(), LocalDateTime.now());
        for (BlockedSubnet bs : blockedSubnets) {
            commands.add(new Command("block_subnet", bs.getCidr(), bs.getReason()));
        }

        SensorResponse response = new SensorResponse();
        response.setStatus("success");
        response.setProcessed_packets(upload.getPackets() != null ? upload.getPackets().size() : 0);
        response.setProcessed_threats(threats != null ? threats.size() : 0);
        response.setCommands(commands);
        return response;
    }

    // ===== Subnet Helpers =====

    private boolean isIpInBlockedSubnet(String ip, List<BlockedSubnet> activeSubnets) {
        if (ip == null || !ip.contains(".") || activeSubnets.isEmpty()) return false;
        String subnet = extractSubnet24(ip);
        if (subnet == null) return false;
        return activeSubnets.stream().anyMatch(bs -> bs.getCidr().equals(subnet));
    }

    private void autoBlockSubnetIfNeeded(String companyId, String srcIp) {
        String subnet = extractSubnet24(srcIp);
        if (subnet == null) return;
        if (blockedSubnetRepository.existsByCompanyIdAndCidr(companyId, subnet)) return;

        // Count how many individual IPs from this /24 are currently blocked
        List<BlockedIP> activeIPs = blockedIPRepository.findActiveByCompanyId(companyId, LocalDateTime.now());
        long sameSubnetCount = activeIPs.stream()
                .filter(b -> subnet.equals(extractSubnet24(b.getIp())))
                .count();

        if (sameSubnetCount >= 3) {
            BlockedSubnet bs = new BlockedSubnet();
            bs.setCidr(subnet);
            bs.setCompanyId(companyId);
            bs.setReason("Auto-blocked: " + sameSubnetCount + " IPs from this subnet individually blocked");
            bs.setBlockedAt(LocalDateTime.now());
            bs.setExpiresAt(LocalDateTime.now().plusHours(72));
            bs.setBlockedBy("sensor-auto");
            try {
                blockedSubnetRepository.save(bs);
            } catch (org.springframework.dao.DataIntegrityViolationException ignored) {}
        }
    }

    private static String extractSubnet24(String ip) {
        if (ip == null || !ip.contains(".")) return null;
        String[] parts = ip.split("\\.");
        if (parts.length != 4) return null;
        return parts[0] + "." + parts[1] + "." + parts[2] + ".0/24";
    }

    // ===== Sensor Catalog =====

    public List<SensorTemplateResponse> listTemplates(String companyId) {
        List<Sensor> templates = sensorRepository.findByIsTemplateTrue();
        return templates.stream().map(tpl -> {
            SensorTemplateResponse r = new SensorTemplateResponse();
            r.setId(tpl.getId());
            r.setName(tpl.getName());
            r.setDescription(tpl.getDescription());
            r.setSensorType(tpl.getSensorType());
            r.setCategory(tpl.getCategory());
            r.setDetectedThreats(tpl.getDetectedThreats());
            r.setTargetAssetTypes(tpl.getTargetAssetTypes());
            r.setIcon(tpl.getIcon());
            r.setConfigInstructions(tpl.getConfigInstructions());
            r.setSetupCommand(tpl.getSetupCommand());

            Optional<Sensor> deployed = sensorRepository.findByCompanyIdAndSourceTemplateId(companyId, tpl.getId());
            r.setAlreadyDeployed(deployed.isPresent());
            deployed.ifPresent(s -> r.setDeployedSensorId(s.getId()));

            return r;
        }).collect(Collectors.toList());
    }

    @Transactional
    public Sensor deploySensor(String companyId, DeploySensorRequest request, String performedBy) {
        Sensor template = sensorRepository.findById(request.getTemplateId())
                .orElseThrow(() -> new RuntimeException("Sensor template not found"));

        if (!Boolean.TRUE.equals(template.getIsTemplate())) {
            throw new RuntimeException("Not a sensor template");
        }

        Optional<Sensor> existing = sensorRepository.findByCompanyIdAndSourceTemplateId(companyId, template.getId());
        if (existing.isPresent()) {
            throw new RuntimeException("Sensor already deployed");
        }

        Sensor sensor = new Sensor();
        sensor.setId(UUID.randomUUID().toString());
        sensor.setCompanyId(companyId);
        sensor.setName(request.getCustomName() != null && !request.getCustomName().isBlank()
                ? request.getCustomName() : template.getName());
        sensor.setStatus("pending");
        sensor.setSensorType(template.getSensorType());
        sensor.setCategory(template.getCategory());
        sensor.setDescription(template.getDescription());
        sensor.setDetectedThreats(template.getDetectedThreats());
        sensor.setTargetAssetTypes(template.getTargetAssetTypes());
        sensor.setIcon(template.getIcon());
        sensor.setConfigInstructions(template.getConfigInstructions());
        sensor.setSetupCommand(template.getSetupCommand());
        sensor.setIsTemplate(false);
        sensor.setSourceTemplateId(template.getId());
        sensor.setRegisteredAt(LocalDateTime.now());
        sensor.setPacketsProcessed(0L);
        sensor.setThreatsDetected(0L);
        sensor = sensorRepository.save(sensor);

        activityLogService.log(companyId, "SENSOR", sensor.getId(), "DEPLOYED", performedBy,
                "Sensor deployed from catalog: " + sensor.getName());

        return sensor;
    }

    public SensorDetailResponse getSensorDetail(String sensorId, String companyId) {
        Sensor sensor = sensorRepository.findById(sensorId)
                .orElseThrow(() -> new RuntimeException("Sensor not found"));
        if (!sensor.getCompanyId().equals(companyId)) {
            throw new RuntimeException("Access denied");
        }

        SensorDetailResponse r = new SensorDetailResponse();
        r.setId(sensor.getId());
        r.setName(sensor.getName());
        r.setCompanyId(sensor.getCompanyId());
        r.setStatus(sensor.getStatus());
        r.setSensorType(sensor.getSensorType());
        r.setCategory(sensor.getCategory());
        r.setDescription(sensor.getDescription());
        r.setDetectedThreats(sensor.getDetectedThreats());
        r.setTargetAssetTypes(sensor.getTargetAssetTypes());
        r.setIcon(sensor.getIcon());
        r.setConfigInstructions(sensor.getConfigInstructions());
        r.setSetupCommand(sensor.getSetupCommand());
        r.setSourceTemplateId(sensor.getSourceTemplateId());
        r.setRegisteredAt(sensor.getRegisteredAt());
        r.setLastSeen(sensor.getLastSeen());
        r.setPacketsProcessed(sensor.getPacketsProcessed());
        r.setThreatsDetected(sensor.getThreatsDetected());

        List<AssetSensorAssignment> assignments = assignmentRepository.findBySensorId(sensorId);
        r.setAssignedAssets(assignments.stream().map(a -> {
            AssetSensorAssignmentResponse ar = new AssetSensorAssignmentResponse();
            ar.setAssetId(a.getAssetId());
            ar.setSensorId(a.getSensorId());
            ar.setIsActive(a.getIsActive());
            ar.setAssignedAt(a.getAssignedAt());
            ar.setAssignedBy(a.getAssignedBy());
            assetRepository.findById(a.getAssetId()).ifPresent(asset -> {
                ar.setAssetName(asset.getName());
                ar.setAssetType(asset.getAssetType().name());
                ar.setAssetIp(asset.getIpAddress());
            });
            ar.setSensorName(sensor.getName());
            ar.setSensorType(sensor.getSensorType());
            ar.setCategory(sensor.getCategory());
            return ar;
        }).collect(Collectors.toList()));

        return r;
    }

    // ===== Assignment Methods =====

    @Transactional
    public AssetSensorAssignmentResponse assignToAsset(String companyId, AssignSensorRequest request, String performedBy) {
        Sensor sensor = sensorRepository.findById(request.getSensorId())
                .orElseThrow(() -> new RuntimeException("Sensor not found"));
        if (!sensor.getCompanyId().equals(companyId)) {
            throw new RuntimeException("Sensor does not belong to company");
        }

        Asset asset = assetRepository.findById(request.getAssetId())
                .orElseThrow(() -> new RuntimeException("Asset not found"));
        if (!asset.getCompanyId().equals(companyId)) {
            throw new RuntimeException("Asset does not belong to company");
        }

        AssetSensorAssignment assignment = new AssetSensorAssignment();
        assignment.setAssetId(request.getAssetId());
        assignment.setSensorId(request.getSensorId());
        assignment.setAssignedAt(LocalDateTime.now());
        assignment.setAssignedBy(performedBy);
        assignment.setIsActive(true);
        assignmentRepository.save(assignment);

        activityLogService.log(companyId, "SENSOR", request.getSensorId(), "ASSIGNED_ASSET", performedBy,
                "Sensor '" + sensor.getName() + "' assigned to asset '" + asset.getName() + "'");

        AssetSensorAssignmentResponse r = new AssetSensorAssignmentResponse();
        r.setAssetId(asset.getId());
        r.setAssetName(asset.getName());
        r.setAssetType(asset.getAssetType().name());
        r.setAssetIp(asset.getIpAddress());
        r.setSensorId(sensor.getId());
        r.setSensorName(sensor.getName());
        r.setSensorType(sensor.getSensorType());
        r.setCategory(sensor.getCategory());
        r.setIsActive(true);
        r.setAssignedAt(assignment.getAssignedAt());
        r.setAssignedBy(performedBy);
        return r;
    }

    @Transactional
    public void unassignFromAsset(String companyId, String sensorId, String assetId, String performedBy) {
        Sensor sensor = sensorRepository.findById(sensorId)
                .orElseThrow(() -> new RuntimeException("Sensor not found"));
        if (!sensor.getCompanyId().equals(companyId)) {
            throw new RuntimeException("Access denied");
        }

        assignmentRepository.deleteByAssetIdAndSensorId(assetId, sensorId);

        activityLogService.log(companyId, "SENSOR", sensorId, "UNASSIGNED_ASSET", performedBy,
                "Sensor unassigned from asset " + assetId);
    }

    @Transactional
    public List<AssetSensorAssignmentResponse> bulkAssign(String companyId, BulkAssignSensorRequest request, String performedBy) {
        Sensor sensor = sensorRepository.findById(request.getSensorId())
                .orElseThrow(() -> new RuntimeException("Sensor not found"));
        if (!sensor.getCompanyId().equals(companyId)) {
            throw new RuntimeException("Access denied");
        }

        List<AssetSensorAssignmentResponse> results = new ArrayList<>();
        for (String assetId : request.getAssetIds()) {
            Asset asset = assetRepository.findById(assetId).orElse(null);
            if (asset == null || !asset.getCompanyId().equals(companyId)) continue;

            AssetSensorAssignment assignment = new AssetSensorAssignment();
            assignment.setAssetId(assetId);
            assignment.setSensorId(request.getSensorId());
            assignment.setAssignedAt(LocalDateTime.now());
            assignment.setAssignedBy(performedBy);
            assignment.setIsActive(true);
            assignmentRepository.save(assignment);

            AssetSensorAssignmentResponse r = new AssetSensorAssignmentResponse();
            r.setAssetId(asset.getId());
            r.setAssetName(asset.getName());
            r.setAssetType(asset.getAssetType().name());
            r.setAssetIp(asset.getIpAddress());
            r.setSensorId(sensor.getId());
            r.setSensorName(sensor.getName());
            r.setSensorType(sensor.getSensorType());
            r.setCategory(sensor.getCategory());
            r.setIsActive(true);
            r.setAssignedAt(assignment.getAssignedAt());
            r.setAssignedBy(performedBy);
            results.add(r);
        }

        activityLogService.log(companyId, "SENSOR", request.getSensorId(), "BULK_ASSIGNED", performedBy,
                "Sensor bulk assigned to " + request.getAssetIds().size() + " assets");

        return results;
    }

    public List<AssetSensorAssignmentResponse> getSensorAssignments(String sensorId, String companyId) {
        Sensor sensor = sensorRepository.findById(sensorId)
                .orElseThrow(() -> new RuntimeException("Sensor not found"));
        if (!sensor.getCompanyId().equals(companyId)) {
            throw new RuntimeException("Access denied");
        }

        List<AssetSensorAssignment> assignments = assignmentRepository.findBySensorId(sensorId);
        return assignments.stream().map(a -> {
            AssetSensorAssignmentResponse r = new AssetSensorAssignmentResponse();
            r.setAssetId(a.getAssetId());
            r.setSensorId(a.getSensorId());
            r.setIsActive(a.getIsActive());
            r.setAssignedAt(a.getAssignedAt());
            r.setAssignedBy(a.getAssignedBy());
            assetRepository.findById(a.getAssetId()).ifPresent(asset -> {
                r.setAssetName(asset.getName());
                r.setAssetType(asset.getAssetType().name());
                r.setAssetIp(asset.getIpAddress());
            });
            r.setSensorName(sensor.getName());
            r.setSensorType(sensor.getSensorType());
            r.setCategory(sensor.getCategory());
            return r;
        }).collect(Collectors.toList());
    }

    @Transactional
    public void removeSensor(String sensorId, String companyId, String performedBy) {
        Sensor sensor = sensorRepository.findById(sensorId)
                .orElseThrow(() -> new RuntimeException("Sensor not found"));
        if (!sensor.getCompanyId().equals(companyId)) {
            throw new RuntimeException("Access denied");
        }
        if (Boolean.TRUE.equals(sensor.getIsTemplate())) {
            throw new RuntimeException("Cannot remove system template");
        }

        sensorRepository.delete(sensor);

        activityLogService.log(companyId, "SENSOR", sensorId, "REMOVED", performedBy,
                "Sensor removed: " + sensor.getName());
    }
}
