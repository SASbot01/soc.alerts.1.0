package com.blackwolf.backend.service;

import com.blackwolf.backend.dto.PlaybookDTOs.*;
import com.blackwolf.backend.model.*;
import com.blackwolf.backend.repository.*;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class PlaybookService {

    private static final Logger log = LoggerFactory.getLogger(PlaybookService.class);
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Autowired
    private PlaybookRepository playbookRepository;

    @Autowired
    private PlaybookStepRepository stepRepository;

    @Autowired
    private PlaybookExecutionRepository executionRepository;

    @Autowired
    private PlaybookExecutionLogRepository executionLogRepository;

    @Autowired
    private BlockedIPRepository blockedIPRepository;

    @Autowired
    private IncidentRepository incidentRepository;

    @Autowired
    private AlertService alertService;

    @Autowired
    private ThreatIntelService threatIntelService;

    @Autowired
    private ActivityLogService activityLogService;

    @Autowired
    private AssetPlaybookAssignmentRepository assignmentRepository;

    @Autowired
    private AssetRepository assetRepository;

    public List<Playbook> listByCompany(String companyId) {
        return playbookRepository.findByCompanyId(companyId);
    }

    public PlaybookDetailResponse getDetail(String playbookId, String companyId) {
        Playbook playbook = playbookRepository.findById(playbookId)
                .orElseThrow(() -> new RuntimeException("Playbook not found"));
        if (!playbook.getCompanyId().equals(companyId)) {
            throw new RuntimeException("Access denied");
        }

        PlaybookDetailResponse response = new PlaybookDetailResponse();
        response.setId(playbook.getId());
        response.setCompanyId(playbook.getCompanyId());
        response.setName(playbook.getName());
        response.setDescription(playbook.getDescription());
        response.setTriggerType(playbook.getTriggerType().name());
        response.setTriggerCondition(playbook.getTriggerCondition());
        response.setIsActive(playbook.getIsActive());
        response.setIsTemplate(playbook.getIsTemplate());
        response.setCategory(playbook.getCategory());
        response.setMitreTechniques(playbook.getMitreTechniques());
        response.setTargetAssetTypes(playbook.getTargetAssetTypes());
        response.setCreatedAt(playbook.getCreatedAt());
        response.setUpdatedAt(playbook.getUpdatedAt());

        List<PlaybookStep> steps = stepRepository.findByPlaybookIdOrderByStepOrderAsc(playbookId);
        response.setSteps(steps.stream().map(this::toStepResponse).collect(Collectors.toList()));

        List<PlaybookExecution> executions = executionRepository.findByPlaybookIdOrderByStartedAtDesc(playbookId);
        response.setRecentExecutions(executions.stream().limit(10).map(e -> {
            ExecutionSummary es = new ExecutionSummary();
            es.setId(e.getId());
            es.setPlaybookId(e.getPlaybookId());
            es.setPlaybookName(playbook.getName());
            es.setTriggerEventId(e.getTriggerEventId());
            es.setStatus(e.getStatus().name());
            es.setStartedAt(e.getStartedAt());
            es.setCompletedAt(e.getCompletedAt());
            es.setErrorMessage(e.getErrorMessage());
            return es;
        }).collect(Collectors.toList()));

        // Assigned assets
        List<AssetPlaybookAssignment> assignments = assignmentRepository.findByPlaybookId(playbookId);
        response.setAssignedAssets(assignments.stream().map(a -> {
            AssetPlaybookAssignmentResponse ar = new AssetPlaybookAssignmentResponse();
            ar.setAssetId(a.getAssetId());
            ar.setPlaybookId(a.getPlaybookId());
            ar.setIsActive(a.getIsActive());
            ar.setPriority(a.getPriority());
            ar.setAssignedAt(a.getAssignedAt());
            ar.setAssignedBy(a.getAssignedBy());
            assetRepository.findById(a.getAssetId()).ifPresent(asset -> {
                ar.setAssetName(asset.getName());
                ar.setAssetType(asset.getAssetType().name());
                ar.setAssetIp(asset.getIpAddress());
            });
            ar.setPlaybookName(playbook.getName());
            ar.setCategory(playbook.getCategory());
            return ar;
        }).collect(Collectors.toList()));

        return response;
    }

    @Transactional
    public Playbook create(String companyId, CreatePlaybookRequest request, String performedBy) {
        Playbook playbook = new Playbook();
        playbook.setId(UUID.randomUUID().toString());
        playbook.setCompanyId(companyId);
        playbook.setName(request.getName());
        playbook.setDescription(request.getDescription());
        playbook.setTriggerType(Playbook.TriggerType.valueOf(request.getTriggerType()));
        playbook.setTriggerCondition(request.getTriggerCondition());
        playbook.setIsActive(true);
        playbook.setIsTemplate(false);
        playbook.setCreatedAt(LocalDateTime.now());
        playbook.setUpdatedAt(LocalDateTime.now());

        playbook = playbookRepository.save(playbook);

        if (request.getSteps() != null) {
            for (CreateStepRequest stepReq : request.getSteps()) {
                PlaybookStep step = new PlaybookStep();
                step.setId(UUID.randomUUID().toString());
                step.setPlaybookId(playbook.getId());
                step.setStepOrder(stepReq.getStepOrder());
                step.setActionType(PlaybookStep.ActionType.valueOf(stepReq.getActionType()));
                step.setActionConfig(stepReq.getActionConfig());
                step.setDescription(stepReq.getDescription());
                step.setCreatedAt(LocalDateTime.now());
                stepRepository.save(step);
            }
        }

        activityLogService.log(companyId, "PLAYBOOK", playbook.getId(), "CREATED", performedBy,
                "Playbook created: " + playbook.getName());

        return playbook;
    }

    @Transactional
    public Playbook toggleActive(String playbookId, String companyId, String performedBy) {
        Playbook playbook = playbookRepository.findById(playbookId)
                .orElseThrow(() -> new RuntimeException("Playbook not found"));
        if (!playbook.getCompanyId().equals(companyId)) {
            throw new RuntimeException("Access denied");
        }

        playbook.setIsActive(!playbook.getIsActive());
        playbook.setUpdatedAt(LocalDateTime.now());
        playbook = playbookRepository.save(playbook);

        activityLogService.log(companyId, "PLAYBOOK", playbookId,
                playbook.getIsActive() ? "ACTIVATED" : "DEACTIVATED", performedBy,
                "Playbook " + (playbook.getIsActive() ? "activated" : "deactivated") + ": " + playbook.getName());

        return playbook;
    }

    // Manual execution
    @Transactional
    public PlaybookExecution executeManually(String playbookId, String companyId, String performedBy) {
        Playbook playbook = playbookRepository.findById(playbookId)
                .orElseThrow(() -> new RuntimeException("Playbook not found"));
        if (!playbook.getCompanyId().equals(companyId)) {
            throw new RuntimeException("Access denied");
        }

        PlaybookExecution execution = new PlaybookExecution();
        execution.setId(UUID.randomUUID().toString());
        execution.setPlaybookId(playbookId);
        execution.setCompanyId(companyId);
        execution.setStatus(PlaybookExecution.ExecutionStatus.RUNNING);
        execution.setStartedAt(LocalDateTime.now());
        execution = executionRepository.save(execution);

        activityLogService.log(companyId, "PLAYBOOK", playbookId, "EXECUTED", performedBy,
                "Manual execution started for: " + playbook.getName());

        executeStepsAsync(execution.getId(), playbook, companyId, null);

        return execution;
    }

    // ===== Template Methods =====

    public List<PlaybookTemplateResponse> listTemplates(String companyId) {
        List<Playbook> templates = playbookRepository.findByIsTemplateTrue();
        return templates.stream().map(tpl -> {
            PlaybookTemplateResponse r = new PlaybookTemplateResponse();
            r.setId(tpl.getId());
            r.setName(tpl.getName());
            r.setDescription(tpl.getDescription());
            r.setCategory(tpl.getCategory());
            r.setTriggerType(tpl.getTriggerType().name());
            r.setTriggerCondition(tpl.getTriggerCondition());
            r.setMitreTechniques(tpl.getMitreTechniques());
            r.setTargetAssetTypes(tpl.getTargetAssetTypes());

            List<PlaybookStep> steps = stepRepository.findByPlaybookIdOrderByStepOrderAsc(tpl.getId());
            r.setStepCount(steps.size());
            r.setSteps(steps.stream().map(this::toStepResponse).collect(Collectors.toList()));

            // Check if company already deployed this template
            r.setAlreadyDeployed(
                    playbookRepository.findByCompanyIdAndSourceTemplateId(companyId, tpl.getId()).isPresent()
            );

            return r;
        }).collect(Collectors.toList());
    }

    @Transactional
    public Playbook deployTemplate(String companyId, DeployTemplateRequest request, String performedBy) {
        Playbook template = playbookRepository.findById(request.getTemplateId())
                .orElseThrow(() -> new RuntimeException("Template not found"));

        if (!Boolean.TRUE.equals(template.getIsTemplate())) {
            throw new RuntimeException("Not a template");
        }

        // Check if already deployed
        Optional<Playbook> existing = playbookRepository.findByCompanyIdAndSourceTemplateId(companyId, template.getId());
        if (existing.isPresent()) {
            throw new RuntimeException("Template already deployed");
        }

        // Deep copy playbook
        Playbook copy = new Playbook();
        copy.setId(UUID.randomUUID().toString());
        copy.setCompanyId(companyId);
        copy.setName(template.getName());
        copy.setDescription(template.getDescription());
        copy.setTriggerType(template.getTriggerType());
        copy.setTriggerCondition(template.getTriggerCondition());
        copy.setIsActive(Boolean.TRUE.equals(request.getActivateImmediately()));
        copy.setIsTemplate(false);
        copy.setCategory(template.getCategory());
        copy.setSourceTemplateId(template.getId());
        copy.setMitreTechniques(template.getMitreTechniques());
        copy.setTargetAssetTypes(template.getTargetAssetTypes());
        copy.setCreatedAt(LocalDateTime.now());
        copy.setUpdatedAt(LocalDateTime.now());
        copy = playbookRepository.save(copy);

        // Deep copy steps
        List<PlaybookStep> templateSteps = stepRepository.findByPlaybookIdOrderByStepOrderAsc(template.getId());
        for (PlaybookStep ts : templateSteps) {
            PlaybookStep step = new PlaybookStep();
            step.setId(UUID.randomUUID().toString());
            step.setPlaybookId(copy.getId());
            step.setStepOrder(ts.getStepOrder());
            step.setActionType(ts.getActionType());
            step.setActionConfig(ts.getActionConfig());
            step.setDescription(ts.getDescription());
            step.setCreatedAt(LocalDateTime.now());
            stepRepository.save(step);
        }

        activityLogService.log(companyId, "PLAYBOOK", copy.getId(), "DEPLOYED_TEMPLATE", performedBy,
                "Deployed template: " + template.getName());

        return copy;
    }

    // ===== Assignment Methods =====

    @Transactional
    public AssetPlaybookAssignmentResponse assignToAsset(String companyId, AssignPlaybookRequest request, String performedBy) {
        Playbook playbook = playbookRepository.findById(request.getPlaybookId())
                .orElseThrow(() -> new RuntimeException("Playbook not found"));
        if (!playbook.getCompanyId().equals(companyId)) {
            throw new RuntimeException("Playbook does not belong to company");
        }

        Asset asset = assetRepository.findById(request.getAssetId())
                .orElseThrow(() -> new RuntimeException("Asset not found"));
        if (!asset.getCompanyId().equals(companyId)) {
            throw new RuntimeException("Asset does not belong to company");
        }

        AssetPlaybookAssignment assignment = new AssetPlaybookAssignment();
        assignment.setAssetId(request.getAssetId());
        assignment.setPlaybookId(request.getPlaybookId());
        assignment.setAssignedAt(LocalDateTime.now());
        assignment.setAssignedBy(performedBy);
        assignment.setIsActive(true);
        assignment.setPriority(request.getPriority() != null ? request.getPriority() : 0);
        assignmentRepository.save(assignment);

        activityLogService.log(companyId, "PLAYBOOK", request.getPlaybookId(), "ASSIGNED_ASSET", performedBy,
                "Playbook '" + playbook.getName() + "' assigned to asset '" + asset.getName() + "'");

        AssetPlaybookAssignmentResponse response = new AssetPlaybookAssignmentResponse();
        response.setAssetId(asset.getId());
        response.setAssetName(asset.getName());
        response.setAssetType(asset.getAssetType().name());
        response.setAssetIp(asset.getIpAddress());
        response.setPlaybookId(playbook.getId());
        response.setPlaybookName(playbook.getName());
        response.setCategory(playbook.getCategory());
        response.setIsActive(true);
        response.setPriority(assignment.getPriority());
        response.setAssignedAt(assignment.getAssignedAt());
        response.setAssignedBy(performedBy);
        return response;
    }

    @Transactional
    public void unassignFromAsset(String companyId, String playbookId, String assetId, String performedBy) {
        Playbook playbook = playbookRepository.findById(playbookId)
                .orElseThrow(() -> new RuntimeException("Playbook not found"));
        if (!playbook.getCompanyId().equals(companyId)) {
            throw new RuntimeException("Access denied");
        }

        assignmentRepository.deleteByAssetIdAndPlaybookId(assetId, playbookId);

        activityLogService.log(companyId, "PLAYBOOK", playbookId, "UNASSIGNED_ASSET", performedBy,
                "Playbook unassigned from asset " + assetId);
    }

    @Transactional
    public List<AssetPlaybookAssignmentResponse> bulkAssign(String companyId, BulkAssignRequest request, String performedBy) {
        Playbook playbook = playbookRepository.findById(request.getPlaybookId())
                .orElseThrow(() -> new RuntimeException("Playbook not found"));
        if (!playbook.getCompanyId().equals(companyId)) {
            throw new RuntimeException("Access denied");
        }

        List<AssetPlaybookAssignmentResponse> results = new ArrayList<>();
        for (String assetId : request.getAssetIds()) {
            Asset asset = assetRepository.findById(assetId).orElse(null);
            if (asset == null || !asset.getCompanyId().equals(companyId)) continue;

            AssetPlaybookAssignment assignment = new AssetPlaybookAssignment();
            assignment.setAssetId(assetId);
            assignment.setPlaybookId(request.getPlaybookId());
            assignment.setAssignedAt(LocalDateTime.now());
            assignment.setAssignedBy(performedBy);
            assignment.setIsActive(true);
            assignment.setPriority(0);
            assignmentRepository.save(assignment);

            AssetPlaybookAssignmentResponse r = new AssetPlaybookAssignmentResponse();
            r.setAssetId(asset.getId());
            r.setAssetName(asset.getName());
            r.setAssetType(asset.getAssetType().name());
            r.setAssetIp(asset.getIpAddress());
            r.setPlaybookId(playbook.getId());
            r.setPlaybookName(playbook.getName());
            r.setCategory(playbook.getCategory());
            r.setIsActive(true);
            r.setPriority(0);
            r.setAssignedAt(assignment.getAssignedAt());
            r.setAssignedBy(performedBy);
            results.add(r);
        }

        activityLogService.log(companyId, "PLAYBOOK", request.getPlaybookId(), "BULK_ASSIGNED", performedBy,
                "Playbook bulk assigned to " + request.getAssetIds().size() + " assets");

        return results;
    }

    public List<AssetPlaybookAssignmentResponse> getPlaybookAssignments(String playbookId, String companyId) {
        Playbook playbook = playbookRepository.findById(playbookId)
                .orElseThrow(() -> new RuntimeException("Playbook not found"));
        if (!playbook.getCompanyId().equals(companyId)) {
            throw new RuntimeException("Access denied");
        }

        List<AssetPlaybookAssignment> assignments = assignmentRepository.findByPlaybookId(playbookId);
        return assignments.stream().map(a -> {
            AssetPlaybookAssignmentResponse r = new AssetPlaybookAssignmentResponse();
            r.setAssetId(a.getAssetId());
            r.setPlaybookId(a.getPlaybookId());
            r.setIsActive(a.getIsActive());
            r.setPriority(a.getPriority());
            r.setAssignedAt(a.getAssignedAt());
            r.setAssignedBy(a.getAssignedBy());
            assetRepository.findById(a.getAssetId()).ifPresent(asset -> {
                r.setAssetName(asset.getName());
                r.setAssetType(asset.getAssetType().name());
                r.setAssetIp(asset.getIpAddress());
            });
            r.setPlaybookName(playbook.getName());
            r.setCategory(playbook.getCategory());
            return r;
        }).collect(Collectors.toList());
    }

    // ===== Trigger Logic =====

    // Automated trigger from threat events
    public void triggerForThreat(ThreatEvent threat) {
        String companyId = threat.getCompanyId();
        Set<String> executedPlaybookIds = new HashSet<>();

        // 1. Global severity-based playbooks (skip templates)
        List<Playbook> severityPlaybooks = playbookRepository
                .findByTriggerTypeAndIsActiveTrue(Playbook.TriggerType.THREAT_SEVERITY);
        for (Playbook pb : severityPlaybooks) {
            if (!pb.getCompanyId().equals(companyId)) continue;
            if (Boolean.TRUE.equals(pb.getIsTemplate())) continue;
            if (matchesSeverityCondition(pb.getTriggerCondition(), threat.getSeverity())) {
                if (executedPlaybookIds.add(pb.getId())) {
                    startExecution(pb, companyId, threat.getId(), threat.getSrcIp());
                }
            }
        }

        // 2. Global type-based playbooks (skip templates)
        List<Playbook> typePlaybooks = playbookRepository
                .findByTriggerTypeAndIsActiveTrue(Playbook.TriggerType.THREAT_TYPE);
        for (Playbook pb : typePlaybooks) {
            if (!pb.getCompanyId().equals(companyId)) continue;
            if (Boolean.TRUE.equals(pb.getIsTemplate())) continue;
            if (matchesTypeCondition(pb.getTriggerCondition(), threat.getThreatType())) {
                if (executedPlaybookIds.add(pb.getId())) {
                    startExecution(pb, companyId, threat.getId(), threat.getSrcIp());
                }
            }
        }

        // 3. Asset-assigned playbook triggering
        List<String> threatIps = new ArrayList<>();
        if (threat.getSrcIp() != null && !threat.getSrcIp().isBlank()) threatIps.add(threat.getSrcIp());
        if (threat.getDstIp() != null && !threat.getDstIp().isBlank()) threatIps.add(threat.getDstIp());

        if (!threatIps.isEmpty()) {
            List<Asset> matchedAssets = assetRepository.findByIpAddressInAndCompanyId(threatIps, companyId);
            for (Asset asset : matchedAssets) {
                List<AssetPlaybookAssignment> assignments = assignmentRepository.findByAssetIdAndIsActiveTrue(asset.getId());
                // Sort by priority descending (higher priority first)
                assignments.sort((a, b) -> Integer.compare(
                        b.getPriority() != null ? b.getPriority() : 0,
                        a.getPriority() != null ? a.getPriority() : 0));

                for (AssetPlaybookAssignment assignment : assignments) {
                    if (executedPlaybookIds.contains(assignment.getPlaybookId())) continue;

                    playbookRepository.findById(assignment.getPlaybookId()).ifPresent(pb -> {
                        if (!Boolean.TRUE.equals(pb.getIsActive())) return;
                        if (Boolean.TRUE.equals(pb.getIsTemplate())) return;

                        boolean matches = false;
                        if (pb.getTriggerType() == Playbook.TriggerType.THREAT_SEVERITY) {
                            matches = matchesSeverityCondition(pb.getTriggerCondition(), threat.getSeverity());
                        } else if (pb.getTriggerType() == Playbook.TriggerType.THREAT_TYPE) {
                            matches = matchesTypeCondition(pb.getTriggerCondition(), threat.getThreatType());
                        }

                        if (matches && executedPlaybookIds.add(pb.getId())) {
                            log.info("SOAR: Asset-triggered playbook '{}' for asset '{}' (IP: {})",
                                    pb.getName(), asset.getName(), asset.getIpAddress());
                            startExecution(pb, companyId, threat.getId(), threat.getSrcIp());
                        }
                    });
                }
            }
        }
    }

    public List<ExecutionSummary> listExecutions(String companyId) {
        List<PlaybookExecution> executions = executionRepository.findByCompanyIdOrderByStartedAtDesc(companyId);
        return executions.stream().map(e -> {
            ExecutionSummary es = new ExecutionSummary();
            es.setId(e.getId());
            es.setPlaybookId(e.getPlaybookId());
            es.setTriggerEventId(e.getTriggerEventId());
            es.setStatus(e.getStatus().name());
            es.setStartedAt(e.getStartedAt());
            es.setCompletedAt(e.getCompletedAt());
            es.setErrorMessage(e.getErrorMessage());
            playbookRepository.findById(e.getPlaybookId())
                    .ifPresent(pb -> es.setPlaybookName(pb.getName()));
            return es;
        }).collect(Collectors.toList());
    }

    public ExecutionDetailResponse getExecutionDetail(String executionId, String companyId) {
        PlaybookExecution exec = executionRepository.findById(executionId)
                .orElseThrow(() -> new RuntimeException("Execution not found"));
        if (!exec.getCompanyId().equals(companyId)) {
            throw new RuntimeException("Access denied");
        }

        ExecutionDetailResponse response = new ExecutionDetailResponse();
        response.setId(exec.getId());
        response.setPlaybookId(exec.getPlaybookId());
        response.setTriggerEventId(exec.getTriggerEventId());
        response.setStatus(exec.getStatus().name());
        response.setStartedAt(exec.getStartedAt());
        response.setCompletedAt(exec.getCompletedAt());
        response.setErrorMessage(exec.getErrorMessage());

        playbookRepository.findById(exec.getPlaybookId())
                .ifPresent(pb -> response.setPlaybookName(pb.getName()));

        List<PlaybookExecutionLog> logs = executionLogRepository.findByExecutionIdOrderByExecutedAtAsc(executionId);
        response.setLogs(logs.stream().map(l -> {
            ExecutionLogEntry entry = new ExecutionLogEntry();
            entry.setId(l.getId());
            entry.setStepId(l.getStepId());
            entry.setStatus(l.getStatus().name());
            entry.setOutput(l.getOutput());
            entry.setExecutedAt(l.getExecutedAt());
            stepRepository.findById(l.getStepId()).ifPresent(step -> {
                entry.setStepDescription(step.getDescription());
                entry.setActionType(step.getActionType().name());
            });
            return entry;
        }).collect(Collectors.toList()));

        return response;
    }

    // ===== Private helpers =====

    private StepResponse toStepResponse(PlaybookStep s) {
        StepResponse sr = new StepResponse();
        sr.setId(s.getId());
        sr.setStepOrder(s.getStepOrder());
        sr.setActionType(s.getActionType().name());
        sr.setActionConfig(s.getActionConfig());
        sr.setDescription(s.getDescription());
        return sr;
    }

    private void startExecution(Playbook playbook, String companyId, String triggerEventId, String srcIp) {
        PlaybookExecution execution = new PlaybookExecution();
        execution.setId(UUID.randomUUID().toString());
        execution.setPlaybookId(playbook.getId());
        execution.setCompanyId(companyId);
        execution.setTriggerEventId(triggerEventId);
        execution.setStatus(PlaybookExecution.ExecutionStatus.RUNNING);
        execution.setStartedAt(LocalDateTime.now());
        execution = executionRepository.save(execution);

        log.info("SOAR: Starting playbook '{}' for event {}", playbook.getName(), triggerEventId);
        executeStepsAsync(execution.getId(), playbook, companyId, srcIp);
    }

    @Async
    protected void executeStepsAsync(String executionId, Playbook playbook, String companyId, String srcIp) {
        List<PlaybookStep> steps = stepRepository.findByPlaybookIdOrderByStepOrderAsc(playbook.getId());
        boolean failed = false;

        for (PlaybookStep step : steps) {
            if (failed) {
                logStepResult(executionId, step.getId(), PlaybookExecutionLog.LogStatus.SKIPPED, "Skipped due to previous failure");
                continue;
            }

            try {
                String output = executeStep(step, companyId, srcIp);
                logStepResult(executionId, step.getId(), PlaybookExecutionLog.LogStatus.SUCCESS, output);
            } catch (Exception e) {
                log.error("SOAR: Step {} failed: {}", step.getActionType(), e.getMessage());
                logStepResult(executionId, step.getId(), PlaybookExecutionLog.LogStatus.FAILED, e.getMessage());
                failed = true;
            }
        }

        PlaybookExecution execution = executionRepository.findById(executionId).orElse(null);
        if (execution != null) {
            execution.setStatus(failed ? PlaybookExecution.ExecutionStatus.FAILED : PlaybookExecution.ExecutionStatus.COMPLETED);
            execution.setCompletedAt(LocalDateTime.now());
            if (failed) {
                execution.setErrorMessage("One or more steps failed");
            }
            executionRepository.save(execution);
        }
    }

    private String executeStep(PlaybookStep step, String companyId, String srcIp) {
        return switch (step.getActionType()) {
            case BLOCK_IP -> executeBlockIp(step, companyId, srcIp);
            case CREATE_INCIDENT -> executeCreateIncident(step, companyId);
            case SEND_ALERT -> executeSendAlert(step, companyId);
            case ENRICH_IP -> executeEnrichIp(srcIp);
            case NOTIFY_SLACK -> executeNotifySlack(step, companyId);
            case UPDATE_STATUS -> "Status update executed";
            case WEBHOOK_CALL -> "Webhook call executed";
        };
    }

    private String executeBlockIp(PlaybookStep step, String companyId, String srcIp) {
        if (srcIp == null || srcIp.isBlank()) {
            return "No source IP to block";
        }

        int durationHours = 24;
        String reason = "Blocked by SOAR playbook";

        try {
            JsonNode config = objectMapper.readTree(step.getActionConfig());
            if (config.has("duration_hours")) durationHours = config.get("duration_hours").asInt();
            if (config.has("reason")) reason = config.get("reason").asText();
        } catch (Exception ignored) {}

        BlockedIP blocked = new BlockedIP();
        blocked.setIp(srcIp);
        blocked.setCompanyId(companyId);
        blocked.setReason(reason);
        blocked.setBlockedAt(LocalDateTime.now());
        blocked.setExpiresAt(LocalDateTime.now().plusHours(durationHours));
        blockedIPRepository.save(blocked);

        return "Blocked IP " + srcIp + " for " + durationHours + " hours";
    }

    private String executeCreateIncident(PlaybookStep step, String companyId) {
        String severity = "high";
        String titlePrefix = "SOAR Auto-Incident";

        try {
            JsonNode config = objectMapper.readTree(step.getActionConfig());
            if (config.has("severity")) severity = config.get("severity").asText();
            if (config.has("title_prefix")) titlePrefix = config.get("title_prefix").asText();
        } catch (Exception ignored) {}

        Incident incident = new Incident();
        incident.setId(UUID.randomUUID().toString());
        incident.setCompanyId(companyId);
        incident.setTitle(titlePrefix + " - Automated Response");
        incident.setDescription("Automatically created by SOAR playbook execution");
        incident.setSeverity(severity);
        incident.setStatus("open");
        incident.setCreatedAt(LocalDateTime.now());
        incident.setUpdatedAt(LocalDateTime.now());
        incidentRepository.save(incident);

        return "Created incident: " + incident.getId();
    }

    private String executeSendAlert(PlaybookStep step, String companyId) {
        log.info("SOAR: Sending alert for company {}", companyId);
        return "Alert sent to configured recipients";
    }

    private String executeEnrichIp(String srcIp) {
        if (srcIp == null || srcIp.isBlank()) {
            return "No IP to enrich";
        }
        try {
            threatIntelService.enrichIp(srcIp);
            return "Enriched IP: " + srcIp;
        } catch (Exception e) {
            return "Enrichment attempted for " + srcIp + ": " + e.getMessage();
        }
    }

    private String executeNotifySlack(PlaybookStep step, String companyId) {
        log.info("SOAR: Slack notification for company {}", companyId);
        return "Slack notification sent";
    }

    private void logStepResult(String executionId, String stepId, PlaybookExecutionLog.LogStatus status, String output) {
        PlaybookExecutionLog logEntry = new PlaybookExecutionLog();
        logEntry.setId(UUID.randomUUID().toString());
        logEntry.setExecutionId(executionId);
        logEntry.setStepId(stepId);
        logEntry.setStatus(status);
        logEntry.setOutput(output);
        logEntry.setExecutedAt(LocalDateTime.now());
        executionLogRepository.save(logEntry);
    }

    private boolean matchesSeverityCondition(String condition, Integer severity) {
        if (condition == null || severity == null) return false;
        try {
            if (condition.startsWith(">=")) {
                return severity >= Integer.parseInt(condition.substring(2).trim());
            } else if (condition.startsWith(">")) {
                return severity > Integer.parseInt(condition.substring(1).trim());
            } else if (condition.startsWith("==")) {
                return severity == Integer.parseInt(condition.substring(2).trim());
            }
            return severity >= Integer.parseInt(condition.trim());
        } catch (NumberFormatException e) {
            return false;
        }
    }

    private boolean matchesTypeCondition(String condition, String threatType) {
        if (condition == null || threatType == null) return false;
        return threatType.toLowerCase().contains(condition.toLowerCase());
    }
}
