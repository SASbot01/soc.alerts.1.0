package com.blackwolf.backend.service;

import com.blackwolf.backend.dto.IntegrationDTOs.*;
import com.blackwolf.backend.model.*;
import com.blackwolf.backend.repository.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class IntegrationService {

    private static final Logger log = LoggerFactory.getLogger(IntegrationService.class);
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final RestTemplate restTemplate = new RestTemplate();

    @Autowired
    private IntegrationRepository integrationRepository;

    @Autowired
    private IntegrationTicketRepository ticketRepository;

    @Autowired
    private IntegrationPageRepository pageRepository;

    // ===== CRUD =====

    public List<IntegrationResponse> listIntegrations(String companyId) {
        return integrationRepository.findByCompanyIdOrderByCreatedAtDesc(companyId)
                .stream().map(this::toResponse).collect(Collectors.toList());
    }

    public IntegrationOverview getOverview(String companyId) {
        List<Integration> all = integrationRepository.findByCompanyIdOrderByCreatedAtDesc(companyId);
        IntegrationOverview overview = new IntegrationOverview();
        overview.setIntegrations(all.stream().map(this::toResponse).collect(Collectors.toList()));
        overview.setTicketingCount((int) all.stream().filter(i -> "ticketing".equals(i.getCategory())).count());
        overview.setAlertingCount((int) all.stream().filter(i -> "alerting".equals(i.getCategory())).count());
        overview.setActiveCount((int) all.stream().filter(Integration::isActive).count());
        return overview;
    }

    public List<AvailableProvider> getAvailableProviders(String companyId) {
        Map<String, Integration> existing = new HashMap<>();
        integrationRepository.findByCompanyIdOrderByCreatedAtDesc(companyId)
                .forEach(i -> existing.put(i.getProvider(), i));

        List<AvailableProvider> providers = new ArrayList<>();

        providers.add(makeProvider("jira", "ticketing", "Jira",
                "Create and sync tickets with Atlassian Jira for incident tracking",
                existing.get("jira")));
        providers.add(makeProvider("servicenow", "ticketing", "ServiceNow",
                "Create incidents in ServiceNow ITSM for enterprise workflows",
                existing.get("servicenow")));
        providers.add(makeProvider("pagerduty", "alerting", "PagerDuty",
                "Page on-call responders for critical security incidents",
                existing.get("pagerduty")));
        providers.add(makeProvider("opsgenie", "alerting", "OpsGenie",
                "Alert on-call teams via Atlassian OpsGenie for rapid response",
                existing.get("opsgenie")));

        return providers;
    }

    @SuppressWarnings("unchecked")
    public IntegrationResponse saveIntegration(String companyId, SaveIntegrationRequest request) {
        String provider = request.getProvider();
        String category = getCategory(provider);

        Integration integration = integrationRepository.findByCompanyIdAndProvider(companyId, provider)
                .orElse(new Integration());

        integration.setCompanyId(companyId);
        integration.setProvider(provider);
        integration.setCategory(category);
        integration.setDisplayName(request.getDisplayName() != null ? request.getDisplayName() : getDefaultName(provider));
        integration.setAutoCreateTickets(request.isAutoCreateTickets());
        integration.setMinSeverityTicket(request.getMinSeverityTicket() != null ? request.getMinSeverityTicket() : 5);
        integration.setAutoPage(request.isAutoPage());
        integration.setMinSeverityPage(request.getMinSeverityPage() != null ? request.getMinSeverityPage() : 7);

        // Build config JSON
        Map<String, String> config = new HashMap<>();
        switch (provider) {
            case "jira":
                config.put("baseUrl", request.getBaseUrl());
                config.put("email", request.getEmail());
                config.put("apiToken", request.getApiToken());
                config.put("projectKey", request.getProjectKey());
                config.put("issueType", request.getIssueType() != null ? request.getIssueType() : "Bug");
                break;
            case "servicenow":
                config.put("instanceUrl", request.getInstanceUrl());
                config.put("username", request.getUsername());
                config.put("password", request.getPassword());
                config.put("tableName", request.getTableName() != null ? request.getTableName() : "incident");
                break;
            case "pagerduty":
                config.put("routingKey", request.getRoutingKey());
                break;
            case "opsgenie":
                config.put("apiKey", request.getApiKey());
                if (request.getTeamId() != null) config.put("teamId", request.getTeamId());
                break;
        }

        try {
            integration.setConfig(objectMapper.writeValueAsString(config));
        } catch (Exception e) {
            throw new RuntimeException("Failed to serialize config", e);
        }

        return toResponse(integrationRepository.save(integration));
    }

    public void toggleActive(String companyId, String integrationId) {
        Integration integration = getIntegration(companyId, integrationId);
        integration.setActive(!integration.isActive());
        integration.setLastError(null);
        integrationRepository.save(integration);
    }

    public void deleteIntegration(String companyId, String integrationId) {
        Integration integration = getIntegration(companyId, integrationId);
        integrationRepository.delete(integration);
    }

    // ===== Test Connection =====

    @SuppressWarnings("unchecked")
    public TestConnectionResponse testConnection(String companyId, String integrationId) {
        Integration integration = getIntegration(companyId, integrationId);
        TestConnectionResponse response = new TestConnectionResponse();

        try {
            Map<String, String> config = objectMapper.readValue(integration.getConfig(), Map.class);

            switch (integration.getProvider()) {
                case "jira":
                    testJira(config);
                    break;
                case "servicenow":
                    testServiceNow(config);
                    break;
                case "pagerduty":
                    response.setSuccess(config.get("routingKey") != null && !config.get("routingKey").isBlank());
                    response.setMessage(response.isSuccess() ? "Routing key configured" : "Missing routing key");
                    return response;
                case "opsgenie":
                    testOpsGenie(config);
                    break;
            }

            integration.setLastSyncAt(LocalDateTime.now());
            integration.setLastError(null);
            integrationRepository.save(integration);

            response.setSuccess(true);
            response.setMessage("Connection successful");
        } catch (Exception e) {
            integration.setLastError(e.getMessage());
            integrationRepository.save(integration);
            response.setSuccess(false);
            response.setMessage("Connection failed: " + e.getMessage());
        }
        return response;
    }

    // ===== Ticket Creation =====

    @SuppressWarnings("unchecked")
    public TicketResponse createTicket(String companyId, String incidentId, String integrationId) {
        Integration integration = getIntegration(companyId, integrationId);
        if (!"ticketing".equals(integration.getCategory())) {
            throw new RuntimeException("Not a ticketing integration");
        }

        try {
            Map<String, String> config = objectMapper.readValue(integration.getConfig(), Map.class);
            TicketResult result;

            switch (integration.getProvider()) {
                case "jira":
                    result = createJiraTicket(config, incidentId);
                    break;
                case "servicenow":
                    result = createServiceNowTicket(config, incidentId);
                    break;
                default:
                    throw new RuntimeException("Unsupported ticketing provider: " + integration.getProvider());
            }

            IntegrationTicket ticket = new IntegrationTicket();
            ticket.setIntegrationId(integrationId);
            ticket.setIncidentId(incidentId);
            ticket.setExternalTicketId(result.ticketId);
            ticket.setExternalTicketUrl(result.ticketUrl);
            ticket.setStatus("open");
            ticketRepository.save(ticket);

            integration.setLastSyncAt(LocalDateTime.now());
            integration.setLastError(null);
            integrationRepository.save(integration);

            TicketResponse resp = new TicketResponse();
            resp.setId(ticket.getId());
            resp.setIncidentId(incidentId);
            resp.setExternalTicketId(result.ticketId);
            resp.setExternalTicketUrl(result.ticketUrl);
            resp.setStatus("open");
            resp.setProvider(integration.getProvider());
            resp.setSyncedAt(ticket.getSyncedAt());
            return resp;
        } catch (Exception e) {
            integration.setLastError(e.getMessage());
            integrationRepository.save(integration);
            throw new RuntimeException("Ticket creation failed: " + e.getMessage(), e);
        }
    }

    // ===== Page / Alert =====

    @SuppressWarnings("unchecked")
    public PageResponse pageIncident(String companyId, String incidentId, String integrationId) {
        Integration integration = getIntegration(companyId, integrationId);
        if (!"alerting".equals(integration.getCategory())) {
            throw new RuntimeException("Not an alerting integration");
        }

        try {
            Map<String, String> config = objectMapper.readValue(integration.getConfig(), Map.class);
            String alertId;

            switch (integration.getProvider()) {
                case "pagerduty":
                    alertId = sendPagerDutyAlert(config, incidentId);
                    break;
                case "opsgenie":
                    alertId = sendOpsGenieAlert(config, incidentId);
                    break;
                default:
                    throw new RuntimeException("Unsupported alerting provider: " + integration.getProvider());
            }

            IntegrationPage page = new IntegrationPage();
            page.setIntegrationId(integrationId);
            page.setIncidentId(incidentId);
            page.setExternalAlertId(alertId);
            page.setStatus("triggered");
            pageRepository.save(page);

            integration.setLastSyncAt(LocalDateTime.now());
            integration.setLastError(null);
            integrationRepository.save(integration);

            PageResponse resp = new PageResponse();
            resp.setId(page.getId());
            resp.setIncidentId(incidentId);
            resp.setExternalAlertId(alertId);
            resp.setStatus("triggered");
            resp.setProvider(integration.getProvider());
            resp.setPagedAt(page.getPagedAt());
            return resp;
        } catch (Exception e) {
            integration.setLastError(e.getMessage());
            integrationRepository.save(integration);
            throw new RuntimeException("Paging failed: " + e.getMessage(), e);
        }
    }

    // ===== Auto-dispatch on incident creation =====

    public void autoDispatchIncident(String companyId, Incident incident) {
        int severity = mapSeverity(incident.getSeverity());

        // Auto-create tickets
        integrationRepository.findByCompanyIdAndCategoryAndIsActiveTrue(companyId, "ticketing").forEach(integration -> {
            if (integration.isAutoCreateTickets() && severity >= integration.getMinSeverityTicket()) {
                try {
                    createTicket(companyId, incident.getId(), integration.getId());
                    log.info("Auto-created {} ticket for incident {}", integration.getProvider(), incident.getId());
                } catch (Exception e) {
                    log.warn("Auto-ticket failed for {}: {}", integration.getProvider(), e.getMessage());
                }
            }
        });

        // Auto-page
        integrationRepository.findByCompanyIdAndCategoryAndIsActiveTrue(companyId, "alerting").forEach(integration -> {
            if (integration.isAutoPage() && severity >= integration.getMinSeverityPage()) {
                try {
                    pageIncident(companyId, incident.getId(), integration.getId());
                    log.info("Auto-paged {} for incident {}", integration.getProvider(), incident.getId());
                } catch (Exception e) {
                    log.warn("Auto-page failed for {}: {}", integration.getProvider(), e.getMessage());
                }
            }
        });
    }

    public List<TicketResponse> getTicketsForIncident(String incidentId) {
        return ticketRepository.findByIncidentId(incidentId).stream().map(t -> {
            TicketResponse r = new TicketResponse();
            r.setId(t.getId());
            r.setIncidentId(t.getIncidentId());
            r.setExternalTicketId(t.getExternalTicketId());
            r.setExternalTicketUrl(t.getExternalTicketUrl());
            r.setStatus(t.getStatus());
            r.setSyncedAt(t.getSyncedAt());
            integrationRepository.findById(t.getIntegrationId()).ifPresent(i -> r.setProvider(i.getProvider()));
            return r;
        }).collect(Collectors.toList());
    }

    // ===== Provider Implementations =====

    private void testJira(Map<String, String> config) {
        HttpHeaders headers = new HttpHeaders();
        headers.setBasicAuth(config.get("email"), config.get("apiToken"));
        headers.setContentType(MediaType.APPLICATION_JSON);

        String url = config.get("baseUrl") + "/rest/api/3/myself";
        restTemplate.exchange(url, HttpMethod.GET, new HttpEntity<>(headers), Map.class);
    }

    private void testServiceNow(Map<String, String> config) {
        HttpHeaders headers = new HttpHeaders();
        headers.setBasicAuth(config.get("username"), config.get("password"));
        headers.set("Accept", "application/json");

        String url = config.get("instanceUrl") + "/api/now/table/" + config.getOrDefault("tableName", "incident") + "?sysparm_limit=1";
        restTemplate.exchange(url, HttpMethod.GET, new HttpEntity<>(headers), Map.class);
    }

    private void testOpsGenie(Map<String, String> config) {
        HttpHeaders headers = new HttpHeaders();
        headers.set("Authorization", "GenieKey " + config.get("apiKey"));

        String url = "https://api.opsgenie.com/v2/heartbeats";
        restTemplate.exchange(url, HttpMethod.GET, new HttpEntity<>(headers), Map.class);
    }

    @SuppressWarnings("unchecked")
    private TicketResult createJiraTicket(Map<String, String> config, String incidentId) {
        HttpHeaders headers = new HttpHeaders();
        headers.setBasicAuth(config.get("email"), config.get("apiToken"));
        headers.setContentType(MediaType.APPLICATION_JSON);

        Map<String, Object> fields = new LinkedHashMap<>();
        fields.put("project", Map.of("key", config.get("projectKey")));
        fields.put("summary", "[BlackWolf SOC] Security Incident: " + incidentId);
        fields.put("description", Map.of(
                "type", "doc", "version", 1,
                "content", List.of(Map.of("type", "paragraph", "content", List.of(
                        Map.of("type", "text", "text", "Security incident created by BlackWolf SOC. Incident ID: " + incidentId)
                )))
        ));
        fields.put("issuetype", Map.of("name", config.getOrDefault("issueType", "Bug")));

        Map<String, Object> body = Map.of("fields", fields);

        String url = config.get("baseUrl") + "/rest/api/3/issue";
        ResponseEntity<Map> response = restTemplate.exchange(url, HttpMethod.POST, new HttpEntity<>(body, headers), Map.class);
        Map<String, Object> data = response.getBody();

        String key = (String) data.get("key");
        String ticketUrl = config.get("baseUrl") + "/browse/" + key;
        return new TicketResult(key, ticketUrl);
    }

    @SuppressWarnings("unchecked")
    private TicketResult createServiceNowTicket(Map<String, String> config, String incidentId) {
        HttpHeaders headers = new HttpHeaders();
        headers.setBasicAuth(config.get("username"), config.get("password"));
        headers.setContentType(MediaType.APPLICATION_JSON);

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("short_description", "[BlackWolf SOC] Security Incident: " + incidentId);
        body.put("description", "Security incident created by BlackWolf SOC. Incident ID: " + incidentId);
        body.put("urgency", "1");
        body.put("impact", "1");

        String table = config.getOrDefault("tableName", "incident");
        String url = config.get("instanceUrl") + "/api/now/table/" + table;
        ResponseEntity<Map> response = restTemplate.exchange(url, HttpMethod.POST, new HttpEntity<>(body, headers), Map.class);
        Map<String, Object> result = (Map<String, Object>) response.getBody().get("result");

        String sysId = (String) result.get("sys_id");
        String number = (String) result.get("number");
        String ticketUrl = config.get("instanceUrl") + "/nav_to.do?uri=incident.do?sys_id=" + sysId;
        return new TicketResult(number != null ? number : sysId, ticketUrl);
    }

    @SuppressWarnings("unchecked")
    private String sendPagerDutyAlert(Map<String, String> config, String incidentId) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("routing_key", config.get("routingKey"));
        body.put("event_action", "trigger");
        body.put("payload", Map.of(
                "summary", "[BlackWolf SOC] Security Incident: " + incidentId,
                "severity", "critical",
                "source", "blackwolf-soc",
                "component", "incident-" + incidentId,
                "group", "security"
        ));

        String url = "https://events.pagerduty.com/v2/enqueue";
        ResponseEntity<Map> response = restTemplate.exchange(url, HttpMethod.POST, new HttpEntity<>(body, headers), Map.class);
        return (String) response.getBody().get("dedup_key");
    }

    @SuppressWarnings("unchecked")
    private String sendOpsGenieAlert(Map<String, String> config, String incidentId) {
        HttpHeaders headers = new HttpHeaders();
        headers.set("Authorization", "GenieKey " + config.get("apiKey"));
        headers.setContentType(MediaType.APPLICATION_JSON);

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("message", "[BlackWolf SOC] Security Incident: " + incidentId);
        body.put("alias", "blackwolf-incident-" + incidentId);
        body.put("description", "Security incident from BlackWolf SOC. Incident ID: " + incidentId);
        body.put("priority", "P1");
        body.put("tags", List.of("security", "blackwolf", "incident"));
        if (config.get("teamId") != null) {
            body.put("responders", List.of(Map.of("id", config.get("teamId"), "type", "team")));
        }

        String url = "https://api.opsgenie.com/v2/alerts";
        ResponseEntity<Map> response = restTemplate.exchange(url, HttpMethod.POST, new HttpEntity<>(body, headers), Map.class);
        return (String) response.getBody().get("requestId");
    }

    // ===== Helpers =====

    private Integration getIntegration(String companyId, String integrationId) {
        Integration integration = integrationRepository.findById(integrationId)
                .orElseThrow(() -> new RuntimeException("Integration not found"));
        if (!integration.getCompanyId().equals(companyId)) {
            throw new RuntimeException("Access denied");
        }
        return integration;
    }

    private IntegrationResponse toResponse(Integration i) {
        IntegrationResponse r = new IntegrationResponse();
        r.setId(i.getId());
        r.setProvider(i.getProvider());
        r.setCategory(i.getCategory());
        r.setDisplayName(i.getDisplayName());
        r.setActive(i.isActive());
        r.setAutoCreateTickets(i.isAutoCreateTickets());
        r.setMinSeverityTicket(i.getMinSeverityTicket());
        r.setAutoPage(i.isAutoPage());
        r.setMinSeverityPage(i.getMinSeverityPage());
        r.setLastSyncAt(i.getLastSyncAt());
        r.setLastError(i.getLastError());
        r.setCreatedAt(i.getCreatedAt());
        r.setConfigured(i.getConfig() != null && !i.getConfig().equals("{}"));
        return r;
    }

    private String getCategory(String provider) {
        return switch (provider) {
            case "jira", "servicenow" -> "ticketing";
            case "pagerduty", "opsgenie" -> "alerting";
            default -> throw new RuntimeException("Unknown provider: " + provider);
        };
    }

    private String getDefaultName(String provider) {
        return switch (provider) {
            case "jira" -> "Jira";
            case "servicenow" -> "ServiceNow";
            case "pagerduty" -> "PagerDuty";
            case "opsgenie" -> "OpsGenie";
            default -> provider;
        };
    }

    private AvailableProvider makeProvider(String provider, String category, String displayName, String description, Integration existing) {
        AvailableProvider p = new AvailableProvider();
        p.setProvider(provider);
        p.setCategory(category);
        p.setDisplayName(displayName);
        p.setDescription(description);
        p.setConfigured(existing != null);
        p.setActive(existing != null && existing.isActive());
        return p;
    }

    private int mapSeverity(String severity) {
        return switch (severity != null ? severity.toLowerCase() : "") {
            case "critical" -> 10;
            case "high" -> 7;
            case "medium" -> 5;
            case "low" -> 3;
            default -> 1;
        };
    }

    private record TicketResult(String ticketId, String ticketUrl) {}
}
