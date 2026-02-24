package com.blackwolf.backend.service.cloudlogs;

import com.blackwolf.backend.model.CloudLogSource;
import com.blackwolf.backend.repository.CloudLogSourceRepository;
import com.blackwolf.backend.repository.ThreatEventRepository;
import com.blackwolf.backend.service.ActivityLogService;
import com.blackwolf.backend.service.ThreatIndexService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.*;

@Service
public class CloudLogIngestionService {

    private static final Logger log = LoggerFactory.getLogger(CloudLogIngestionService.class);
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Autowired
    private CloudLogSourceRepository cloudLogSourceRepository;

    @Autowired
    private ThreatEventRepository threatEventRepository;

    @Autowired
    private ThreatIndexService threatIndexService;

    @Autowired
    private ActivityLogService activityLogService;

    // ===== CRUD =====

    public List<CloudLogSource> listSources(String companyId) {
        return cloudLogSourceRepository.findByCompanyIdOrderByCreatedAtDesc(companyId);
    }

    @SuppressWarnings("unchecked")
    public CloudLogSource createSource(String companyId, Map<String, Object> request, String performedBy) {
        CloudLogSource source = new CloudLogSource();
        source.setCompanyId(companyId);
        source.setProvider((String) request.get("provider"));
        source.setSourceType((String) request.get("sourceType"));
        source.setName((String) request.get("name"));

        Map<String, Object> config = (Map<String, Object>) request.getOrDefault("config", Map.of());
        try {
            source.setConfig(objectMapper.writeValueAsString(config));
        } catch (Exception e) {
            throw new RuntimeException("Failed to serialize config", e);
        }

        CloudLogSource saved = cloudLogSourceRepository.save(source);
        activityLogService.log(companyId, "cloud_log_source", saved.getId(), "created",
                performedBy, "Created cloud log source: " + saved.getName() + " (" + saved.getProvider() + ")");
        log.info("Cloud log source created: {} [{}] for company {}", saved.getName(), saved.getProvider(), companyId);
        return saved;
    }

    @SuppressWarnings("unchecked")
    public CloudLogSource updateSource(String companyId, String sourceId, Map<String, Object> request, String performedBy) {
        CloudLogSource source = getSource(companyId, sourceId);

        if (request.containsKey("name")) source.setName((String) request.get("name"));
        if (request.containsKey("sourceType")) source.setSourceType((String) request.get("sourceType"));
        if (request.containsKey("provider")) source.setProvider((String) request.get("provider"));

        if (request.containsKey("config")) {
            Map<String, Object> config = (Map<String, Object>) request.get("config");
            try {
                source.setConfig(objectMapper.writeValueAsString(config));
            } catch (Exception e) {
                throw new RuntimeException("Failed to serialize config", e);
            }
        }

        source.setLastError(null);
        CloudLogSource saved = cloudLogSourceRepository.save(source);
        activityLogService.log(companyId, "cloud_log_source", saved.getId(), "updated",
                performedBy, "Updated cloud log source: " + saved.getName());
        return saved;
    }

    public void deleteSource(String companyId, String sourceId, String performedBy) {
        CloudLogSource source = getSource(companyId, sourceId);
        cloudLogSourceRepository.delete(source);
        activityLogService.log(companyId, "cloud_log_source", sourceId, "deleted",
                performedBy, "Deleted cloud log source: " + source.getName());
        log.info("Cloud log source deleted: {} [{}]", source.getName(), sourceId);
    }

    public CloudLogSource toggleActive(String companyId, String sourceId, String performedBy) {
        CloudLogSource source = getSource(companyId, sourceId);
        source.setActive(!source.isActive());
        source.setLastError(null);
        CloudLogSource saved = cloudLogSourceRepository.save(source);
        activityLogService.log(companyId, "cloud_log_source", sourceId,
                saved.isActive() ? "activated" : "deactivated",
                performedBy, "Toggled cloud log source: " + source.getName() + " -> " + (saved.isActive() ? "active" : "inactive"));
        return saved;
    }

    // ===== Scheduled Polling =====

    @Scheduled(fixedRate = 300000) // every 5 minutes
    public void pollActiveSources() {
        log.debug("Polling active cloud log sources...");

        for (String provider : List.of("aws", "azure", "gcp")) {
            List<CloudLogSource> sources = cloudLogSourceRepository.findByIsActiveTrueAndProvider(provider);
            for (CloudLogSource source : sources) {
                try {
                    switch (provider) {
                        case "aws" -> ingestFromAws(source);
                        case "azure" -> ingestFromAzure(source);
                        case "gcp" -> ingestFromGcp(source);
                    }
                } catch (Exception e) {
                    log.error("Failed to poll cloud log source {} [{}]: {}", source.getName(), source.getId(), e.getMessage());
                    source.setLastError(e.getMessage());
                    cloudLogSourceRepository.save(source);
                }
            }
        }
    }

    // ===== Provider-specific Ingesters (Placeholders) =====

    private void ingestFromAws(CloudLogSource source) {
        log.info("Ingesting from AWS source: {} [type={}]", source.getName(), source.getSourceType());
        // TODO: Implement AWS CloudTrail / CloudWatch / S3 log ingestion
        // - Parse source.getConfig() for region, roleArn, logGroup, bucketName, etc.
        // - Use AWS SDK to pull logs since source.getLastPollAt()
        // - Convert raw log entries into ThreatEvent objects
        // - Save to threatEventRepository and index via threatIndexService

        long ingested = 0; // placeholder: would be the count of events pulled
        source.setLastPollAt(LocalDateTime.now());
        source.setEventsIngested(source.getEventsIngested() + ingested);
        source.setLastError(null);
        cloudLogSourceRepository.save(source);
        log.info("AWS ingestion complete for {}: {} events", source.getName(), ingested);
    }

    private void ingestFromAzure(CloudLogSource source) {
        log.info("Ingesting from Azure source: {} [type={}]", source.getName(), source.getSourceType());
        // TODO: Implement Azure Monitor / Sentinel / Activity Log ingestion
        // - Parse source.getConfig() for tenantId, clientId, clientSecret, subscriptionId, etc.
        // - Use Azure SDK / REST API to pull logs since source.getLastPollAt()
        // - Convert raw log entries into ThreatEvent objects
        // - Save to threatEventRepository and index via threatIndexService

        long ingested = 0; // placeholder
        source.setLastPollAt(LocalDateTime.now());
        source.setEventsIngested(source.getEventsIngested() + ingested);
        source.setLastError(null);
        cloudLogSourceRepository.save(source);
        log.info("Azure ingestion complete for {}: {} events", source.getName(), ingested);
    }

    private void ingestFromGcp(CloudLogSource source) {
        log.info("Ingesting from GCP source: {} [type={}]", source.getName(), source.getSourceType());
        // TODO: Implement GCP Cloud Logging / Security Command Center ingestion
        // - Parse source.getConfig() for projectId, serviceAccountKey, logName, etc.
        // - Use GCP SDK to pull logs since source.getLastPollAt()
        // - Convert raw log entries into ThreatEvent objects
        // - Save to threatEventRepository and index via threatIndexService

        long ingested = 0; // placeholder
        source.setLastPollAt(LocalDateTime.now());
        source.setEventsIngested(source.getEventsIngested() + ingested);
        source.setLastError(null);
        cloudLogSourceRepository.save(source);
        log.info("GCP ingestion complete for {}: {} events", source.getName(), ingested);
    }

    // ===== Test Connection =====

    public Map<String, Object> testConnection(String companyId, String sourceId) {
        CloudLogSource source = getSource(companyId, sourceId);
        Map<String, Object> result = new LinkedHashMap<>();

        try {
            switch (source.getProvider()) {
                case "aws" -> testAwsConnection(source);
                case "azure" -> testAzureConnection(source);
                case "gcp" -> testGcpConnection(source);
                default -> throw new RuntimeException("Unknown provider: " + source.getProvider());
            }
            source.setLastError(null);
            cloudLogSourceRepository.save(source);

            result.put("status", "ok");
            result.put("message", "Connection to " + source.getProvider().toUpperCase() + " successful");
            result.put("provider", source.getProvider());
            result.put("sourceType", source.getSourceType());
        } catch (Exception e) {
            source.setLastError(e.getMessage());
            cloudLogSourceRepository.save(source);

            result.put("status", "error");
            result.put("message", "Connection failed: " + e.getMessage());
            result.put("provider", source.getProvider());
        }

        return result;
    }

    private void testAwsConnection(CloudLogSource source) {
        log.info("Testing AWS connection for source: {}", source.getName());
        // TODO: Validate AWS credentials by calling STS GetCallerIdentity
        // For now, verify config contains required fields
        validateConfigFields(source, "region", "accessKeyId", "secretAccessKey");
    }

    private void testAzureConnection(CloudLogSource source) {
        log.info("Testing Azure connection for source: {}", source.getName());
        // TODO: Validate Azure credentials by requesting an OAuth token
        // For now, verify config contains required fields
        validateConfigFields(source, "tenantId", "clientId", "clientSecret");
    }

    private void testGcpConnection(CloudLogSource source) {
        log.info("Testing GCP connection for source: {}", source.getName());
        // TODO: Validate GCP credentials by calling a metadata endpoint
        // For now, verify config contains required fields
        validateConfigFields(source, "projectId", "serviceAccountKey");
    }

    @SuppressWarnings("unchecked")
    private void validateConfigFields(CloudLogSource source, String... requiredFields) {
        try {
            Map<String, Object> config = objectMapper.readValue(source.getConfig(), Map.class);
            List<String> missing = new ArrayList<>();
            for (String field : requiredFields) {
                Object value = config.get(field);
                if (value == null || (value instanceof String && ((String) value).isBlank())) {
                    missing.add(field);
                }
            }
            if (!missing.isEmpty()) {
                throw new RuntimeException("Missing required config fields: " + String.join(", ", missing));
            }
        } catch (RuntimeException e) {
            throw e;
        } catch (Exception e) {
            throw new RuntimeException("Invalid config JSON: " + e.getMessage(), e);
        }
    }

    // ===== Helpers =====

    private CloudLogSource getSource(String companyId, String sourceId) {
        CloudLogSource source = cloudLogSourceRepository.findById(sourceId)
                .orElseThrow(() -> new RuntimeException("Cloud log source not found"));
        if (!source.getCompanyId().equals(companyId)) {
            throw new RuntimeException("Access denied");
        }
        return source;
    }
}
