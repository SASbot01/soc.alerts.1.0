package com.blackwolf.backend.service;

import com.blackwolf.backend.dto.AssetDTOs.*;
import com.blackwolf.backend.model.*;
import com.blackwolf.backend.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class AssetService {

    @Autowired
    private AssetRepository assetRepository;

    @Autowired
    private AssetVulnerabilityRepository assetVulnerabilityRepository;

    @Autowired
    private VulnerabilityRepository vulnerabilityRepository;

    @Autowired
    private ThreatEventRepository threatEventRepository;

    @Autowired
    private AssetPlaybookAssignmentRepository assetPlaybookAssignmentRepository;

    @Autowired
    private PlaybookRepository playbookRepository;

    @Autowired
    private AssetSensorAssignmentRepository assetSensorAssignmentRepository;

    @Autowired
    private SensorRepository sensorRepository;

    @Autowired
    private ActivityLogService activityLogService;

    public List<Asset> listByCompany(String companyId, String assetType, String criticality) {
        if (assetType != null && !assetType.isEmpty()) {
            return assetRepository.findByCompanyIdAndAssetType(companyId, Asset.AssetType.valueOf(assetType));
        }
        if (criticality != null && !criticality.isEmpty()) {
            return assetRepository.findByCompanyIdAndCriticality(companyId, Asset.Criticality.valueOf(criticality));
        }
        return assetRepository.findByCompanyId(companyId);
    }

    public AssetDetailResponse getDetail(String assetId, String companyId) {
        Asset asset = assetRepository.findById(assetId)
                .orElseThrow(() -> new RuntimeException("Asset not found"));
        if (!asset.getCompanyId().equals(companyId)) {
            throw new RuntimeException("Access denied");
        }

        AssetDetailResponse response = new AssetDetailResponse();
        response.setId(asset.getId());
        response.setCompanyId(asset.getCompanyId());
        response.setName(asset.getName());
        response.setAssetType(asset.getAssetType().name());
        response.setIpAddress(asset.getIpAddress());
        response.setHostname(asset.getHostname());
        response.setOperatingSystem(asset.getOperatingSystem());
        response.setCriticality(asset.getCriticality().name());
        response.setOwner(asset.getOwner());
        response.setLocation(asset.getLocation());
        response.setStatus(asset.getStatus().name());
        response.setNotes(asset.getNotes());
        response.setCreatedAt(asset.getCreatedAt());
        response.setUpdatedAt(asset.getUpdatedAt());

        // Linked vulnerabilities
        List<AssetVulnerability> assetVulns = assetVulnerabilityRepository.findByAssetId(assetId);
        List<LinkedVulnerability> linkedVulns = new ArrayList<>();
        for (AssetVulnerability av : assetVulns) {
            vulnerabilityRepository.findById(av.getVulnerabilityId()).ifPresent(v -> {
                LinkedVulnerability lv = new LinkedVulnerability();
                lv.setId(v.getId());
                lv.setTitle(v.getTitle());
                lv.setCveId(v.getCveId());
                lv.setRiskLevel(v.getRiskLevel());
                lv.setStatus(v.getStatus());
                lv.setDiscoveredAt(av.getDiscoveredAt());
                linkedVulns.add(lv);
            });
        }
        response.setVulnerabilities(linkedVulns);

        // Linked threats by IP address
        List<LinkedThreat> linkedThreats = new ArrayList<>();
        if (asset.getIpAddress() != null && !asset.getIpAddress().isEmpty()) {
            List<ThreatEvent> threats = threatEventRepository.findByCompanyId(companyId);
            for (ThreatEvent te : threats) {
                if (asset.getIpAddress().equals(te.getSrcIp()) || asset.getIpAddress().equals(te.getDstIp())) {
                    LinkedThreat lt = new LinkedThreat();
                    lt.setId(te.getId());
                    lt.setThreatType(te.getThreatType());
                    lt.setSeverity(te.getSeverity());
                    lt.setSrcIp(te.getSrcIp());
                    lt.setDstIp(te.getDstIp());
                    lt.setTimestamp(te.getTimestamp());
                    lt.setStatus(te.getStatus());
                    linkedThreats.add(lt);
                }
            }
        }
        response.setThreats(linkedThreats);

        // Linked playbooks
        List<AssetPlaybookAssignment> assignments = assetPlaybookAssignmentRepository.findByAssetId(assetId);
        List<LinkedPlaybook> linkedPlaybooks = new ArrayList<>();
        for (AssetPlaybookAssignment apa : assignments) {
            playbookRepository.findById(apa.getPlaybookId()).ifPresent(pb -> {
                LinkedPlaybook lp = new LinkedPlaybook();
                lp.setPlaybookId(pb.getId());
                lp.setPlaybookName(pb.getName());
                lp.setCategory(pb.getCategory());
                lp.setIsActive(apa.getIsActive());
                lp.setPriority(apa.getPriority());
                linkedPlaybooks.add(lp);
            });
        }
        response.setPlaybooks(linkedPlaybooks);

        // Linked sensors
        List<AssetSensorAssignment> sensorAssignments = assetSensorAssignmentRepository.findByAssetId(assetId);
        List<LinkedSensor> linkedSensors = new ArrayList<>();
        for (AssetSensorAssignment asa : sensorAssignments) {
            sensorRepository.findById(asa.getSensorId()).ifPresent(s -> {
                LinkedSensor ls = new LinkedSensor();
                ls.setSensorId(s.getId());
                ls.setSensorName(s.getName());
                ls.setSensorType(s.getSensorType());
                ls.setCategory(s.getCategory());
                ls.setIsActive(asa.getIsActive());
                linkedSensors.add(ls);
            });
        }
        response.setSensors(linkedSensors);

        return response;
    }

    @Transactional
    public Asset createAsset(String companyId, CreateAssetRequest request, String performedBy) {
        Asset asset = new Asset();
        asset.setId(UUID.randomUUID().toString());
        asset.setCompanyId(companyId);
        asset.setName(request.getName());
        asset.setAssetType(Asset.AssetType.valueOf(request.getAssetType()));
        asset.setIpAddress(request.getIpAddress());
        asset.setHostname(request.getHostname());
        asset.setOperatingSystem(request.getOperatingSystem());
        asset.setCriticality(request.getCriticality() != null
                ? Asset.Criticality.valueOf(request.getCriticality()) : Asset.Criticality.MEDIUM);
        asset.setOwner(request.getOwner());
        asset.setLocation(request.getLocation());
        asset.setStatus(Asset.AssetStatus.ACTIVE);
        asset.setNotes(request.getNotes());
        asset.setCreatedAt(LocalDateTime.now());
        asset.setUpdatedAt(LocalDateTime.now());

        asset = assetRepository.save(asset);

        activityLogService.log(companyId, "ASSET", asset.getId(), "CREATED", performedBy,
                "Asset created: " + asset.getName() + " [" + asset.getAssetType() + "]");

        return asset;
    }

    @Transactional
    public Asset updateAsset(String assetId, String companyId, UpdateAssetRequest request, String performedBy) {
        Asset asset = assetRepository.findById(assetId)
                .orElseThrow(() -> new RuntimeException("Asset not found"));
        if (!asset.getCompanyId().equals(companyId)) {
            throw new RuntimeException("Access denied");
        }

        if (request.getName() != null) asset.setName(request.getName());
        if (request.getAssetType() != null) asset.setAssetType(Asset.AssetType.valueOf(request.getAssetType()));
        if (request.getIpAddress() != null) asset.setIpAddress(request.getIpAddress());
        if (request.getHostname() != null) asset.setHostname(request.getHostname());
        if (request.getOperatingSystem() != null) asset.setOperatingSystem(request.getOperatingSystem());
        if (request.getCriticality() != null) asset.setCriticality(Asset.Criticality.valueOf(request.getCriticality()));
        if (request.getOwner() != null) asset.setOwner(request.getOwner());
        if (request.getLocation() != null) asset.setLocation(request.getLocation());
        if (request.getStatus() != null) asset.setStatus(Asset.AssetStatus.valueOf(request.getStatus()));
        if (request.getNotes() != null) asset.setNotes(request.getNotes());
        asset.setUpdatedAt(LocalDateTime.now());

        asset = assetRepository.save(asset);

        activityLogService.log(companyId, "ASSET", asset.getId(), "UPDATED", performedBy,
                "Asset updated: " + asset.getName());

        return asset;
    }

    @Transactional
    public void deleteAsset(String assetId, String companyId, String performedBy) {
        Asset asset = assetRepository.findById(assetId)
                .orElseThrow(() -> new RuntimeException("Asset not found"));
        if (!asset.getCompanyId().equals(companyId)) {
            throw new RuntimeException("Access denied");
        }

        assetRepository.delete(asset);

        activityLogService.log(companyId, "ASSET", assetId, "DELETED", performedBy,
                "Asset deleted: " + asset.getName());
    }

    public AssetDashboard getDashboard(String companyId) {
        List<Asset> all = assetRepository.findByCompanyId(companyId);

        AssetDashboard dashboard = new AssetDashboard();
        dashboard.setTotalAssets(all.size());

        dashboard.setByType(all.stream()
                .collect(Collectors.groupingBy(a -> a.getAssetType().name(), Collectors.counting())));

        dashboard.setByCriticality(all.stream()
                .collect(Collectors.groupingBy(a -> a.getCriticality().name(), Collectors.counting())));

        dashboard.setByStatus(all.stream()
                .collect(Collectors.groupingBy(a -> a.getStatus().name(), Collectors.counting())));

        return dashboard;
    }
}
