package com.blackwolf.backend.service;

import com.blackwolf.backend.model.HuntResult;
import com.blackwolf.backend.model.SavedHunt;
import com.blackwolf.backend.repository.HuntResultRepository;
import com.blackwolf.backend.repository.SavedHuntRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;

@Service
public class ThreatHuntingService {

    private static final Logger log = LoggerFactory.getLogger(ThreatHuntingService.class);
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Autowired
    private SavedHuntRepository huntRepository;

    @Autowired
    private HuntResultRepository resultRepository;

    @Autowired
    private ThreatIndexService threatIndexService;

    @Autowired
    private ActivityLogService activityLogService;

    public List<SavedHunt> listHunts(String companyId) {
        return huntRepository.findByCompanyIdOrderByUpdatedAtDesc(companyId);
    }

    public SavedHunt getHunt(String huntId, String companyId) {
        SavedHunt hunt = huntRepository.findById(huntId)
                .orElseThrow(() -> new RuntimeException("Hunt not found"));
        if (!hunt.getCompanyId().equals(companyId)) {
            throw new RuntimeException("Access denied");
        }
        return hunt;
    }

    @Transactional
    public SavedHunt createHunt(String companyId, Map<String, Object> request, String performedBy) {
        SavedHunt hunt = new SavedHunt();
        hunt.setCompanyId(companyId);
        hunt.setName((String) request.get("name"));
        hunt.setDescription((String) request.get("description"));
        hunt.setHuntType((String) request.getOrDefault("huntType", "manual"));
        hunt.setScheduleCron((String) request.get("scheduleCron"));
        hunt.setTags((String) request.get("tags"));
        hunt.setCreatedBy(performedBy);

        try {
            Object queryConfig = request.get("queryConfig");
            if (queryConfig instanceof String) {
                hunt.setQueryConfig((String) queryConfig);
            } else {
                hunt.setQueryConfig(objectMapper.writeValueAsString(queryConfig));
            }
        } catch (Exception e) {
            hunt.setQueryConfig("{}");
        }

        hunt = huntRepository.save(hunt);

        activityLogService.log(companyId, "HUNT", hunt.getId(), "CREATED", performedBy,
                "Threat hunt created: " + hunt.getName());

        return hunt;
    }

    @Transactional
    public SavedHunt updateHunt(String huntId, String companyId, Map<String, Object> request, String performedBy) {
        SavedHunt hunt = getHunt(huntId, companyId);

        if (request.containsKey("name")) hunt.setName((String) request.get("name"));
        if (request.containsKey("description")) hunt.setDescription((String) request.get("description"));
        if (request.containsKey("huntType")) hunt.setHuntType((String) request.get("huntType"));
        if (request.containsKey("scheduleCron")) hunt.setScheduleCron((String) request.get("scheduleCron"));
        if (request.containsKey("tags")) hunt.setTags((String) request.get("tags"));
        if (request.containsKey("isActive")) hunt.setIsActive((Boolean) request.get("isActive"));

        if (request.containsKey("queryConfig")) {
            try {
                Object queryConfig = request.get("queryConfig");
                if (queryConfig instanceof String) {
                    hunt.setQueryConfig((String) queryConfig);
                } else {
                    hunt.setQueryConfig(objectMapper.writeValueAsString(queryConfig));
                }
            } catch (Exception ignored) {}
        }

        return huntRepository.save(hunt);
    }

    @Transactional
    public void deleteHunt(String huntId, String companyId, String performedBy) {
        SavedHunt hunt = getHunt(huntId, companyId);
        huntRepository.delete(hunt);
        activityLogService.log(companyId, "HUNT", huntId, "DELETED", performedBy,
                "Threat hunt deleted: " + hunt.getName());
    }

    @Transactional
    @SuppressWarnings("unchecked")
    public Map<String, Object> executeHunt(String huntId, String companyId, String performedBy) {
        SavedHunt hunt = getHunt(huntId, companyId);

        long startTime = System.currentTimeMillis();

        // Parse query config and execute search
        Map<String, Object> queryConfig;
        try {
            queryConfig = objectMapper.readValue(hunt.getQueryConfig(), Map.class);
        } catch (Exception e) {
            queryConfig = new HashMap<>();
        }

        Map<String, Object> searchResults = threatIndexService.search(companyId, queryConfig);
        long executionTime = System.currentTimeMillis() - startTime;

        // Save result
        int resultCount = 0;
        Object total = searchResults.get("total");
        if (total instanceof Number) resultCount = ((Number) total).intValue();

        HuntResult result = new HuntResult();
        result.setHuntId(huntId);
        result.setCompanyId(companyId);
        result.setResultCount(resultCount);
        result.setExecutionTimeMs(executionTime);
        result.setExecutedBy(performedBy);

        try {
            // Store summary findings
            Map<String, Object> findings = new LinkedHashMap<>();
            findings.put("totalHits", resultCount);
            findings.put("executionTimeMs", executionTime);
            result.setFindings(objectMapper.writeValueAsString(findings));
        } catch (Exception ignored) {}

        resultRepository.save(result);

        // Update hunt metadata
        hunt.setLastRunAt(LocalDateTime.now());
        hunt.setLastResultCount(resultCount);
        huntRepository.save(hunt);

        activityLogService.log(companyId, "HUNT", huntId, "EXECUTED", performedBy,
                "Hunt '" + hunt.getName() + "' executed: " + resultCount + " results in " + executionTime + "ms");

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("huntId", huntId);
        response.put("resultId", result.getId());
        response.put("resultCount", resultCount);
        response.put("executionTimeMs", executionTime);
        response.put("results", searchResults);
        return response;
    }

    public Map<String, Object> quickSearch(String companyId, Map<String, Object> query) {
        return threatIndexService.search(companyId, query);
    }

    public Map<String, Object> getAggregations(String companyId, String field, String timeRange) {
        return threatIndexService.aggregate(companyId, field, timeRange);
    }

    public List<HuntResult> getHuntHistory(String huntId, String companyId) {
        SavedHunt hunt = getHunt(huntId, companyId);
        return resultRepository.findByHuntIdOrderByExecutedAtDesc(huntId);
    }

    // Run scheduled hunts
    @Scheduled(fixedRate = 300000) // every 5 minutes
    public void runScheduledHunts() {
        List<SavedHunt> scheduled = huntRepository.findByHuntTypeAndIsActiveTrue("scheduled");
        for (SavedHunt hunt : scheduled) {
            if (hunt.getScheduleCron() == null) continue;
            // Simple interval check: if last run was more than the interval ago
            if (hunt.getLastRunAt() != null && hunt.getLastRunAt().plusMinutes(5).isAfter(LocalDateTime.now())) {
                continue;
            }
            try {
                executeHunt(hunt.getId(), hunt.getCompanyId(), "system-scheduler");
                log.info("Scheduled hunt '{}' executed for company {}", hunt.getName(), hunt.getCompanyId());
            } catch (Exception e) {
                log.error("Scheduled hunt '{}' failed: {}", hunt.getName(), e.getMessage());
            }
        }
    }
}
