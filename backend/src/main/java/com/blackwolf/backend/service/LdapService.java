package com.blackwolf.backend.service;

import com.blackwolf.backend.dto.InfrastructureDTOs.*;
import com.blackwolf.backend.model.LdapSyncLog;
import com.blackwolf.backend.repository.LdapSyncLogRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.time.LocalDateTime;
import java.util.*;

@Service
public class LdapService {

    private static final Logger log = LoggerFactory.getLogger(LdapService.class);

    @Autowired
    private LdapSyncLogRepository syncLogRepository;

    @Value("${ldap.url:http://lldap:17170}")
    private String ldapApiUrl;

    @Value("${ldap.admin-user:admin}")
    private String ldapAdminUser;

    @Value("${ldap.admin-password:${LDAP_ADMIN_PASSWORD:admin}}")
    private String ldapAdminPassword;

    @Value("${ldap.base-dn:dc=blackwolf,dc=io}")
    private String baseDn;

    private final RestTemplate restTemplate = new RestTemplate();

    public LdapConfig getConfig(String companyId) {
        LdapConfig config = new LdapConfig();
        config.setLdapUrl(ldapApiUrl);
        config.setAdminUser(ldapAdminUser);
        config.setBaseDn(baseDn);

        // Test connection
        try {
            String token = authenticate();
            config.setConnected(token != null && !token.isEmpty());
        } catch (Exception e) {
            config.setConnected(false);
        }

        return config;
    }

    public LdapSyncResponse createUsers(String companyId, LdapBulkCreateRequest request, String performedBy) {
        LdapSyncResponse response = new LdapSyncResponse();
        List<LdapSyncResult> results = new ArrayList<>();
        int created = 0, failed = 0;

        String token;
        try {
            token = authenticate();
        } catch (Exception e) {
            log.error("Failed to authenticate with LDAP: {}", e.getMessage());
            throw new RuntimeException("Cannot connect to LDAP server: " + e.getMessage());
        }

        for (LdapUserCreateRequest user : request.getUsers()) {
            LdapSyncResult result = new LdapSyncResult();
            result.setUsername(user.getUsername());

            try {
                createLdapUser(token, user);

                // Add to group if specified
                if (user.getGroup() != null && !user.getGroup().isBlank()) {
                    addUserToGroup(token, user.getUsername(), user.getGroup());
                }

                result.setStatus("SUCCESS");
                created++;

                logSync(companyId, "CREATE", user.getUsername(), user.getGroup(), "SUCCESS", null, performedBy);
            } catch (Exception e) {
                result.setStatus("FAILED");
                result.setError(e.getMessage());
                failed++;

                logSync(companyId, "CREATE", user.getUsername(), user.getGroup(), "FAILED", e.getMessage(), performedBy);
            }

            results.add(result);
        }

        response.setCreated(created);
        response.setFailed(failed);
        response.setResults(results);
        return response;
    }

    public List<LdapSyncLog> getSyncLogs(String companyId) {
        return syncLogRepository.findByCompanyIdOrderByPerformedAtDesc(companyId);
    }

    private String authenticate() {
        Map<String, String> body = new HashMap<>();
        body.put("username", ldapAdminUser);
        body.put("password", ldapAdminPassword);

        ResponseEntity<Map> response = restTemplate.postForEntity(
                ldapApiUrl + "/auth/simple/login", body, Map.class);

        if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
            return (String) response.getBody().get("token");
        }
        throw new RuntimeException("LDAP authentication failed");
    }

    private void createLdapUser(String token, LdapUserCreateRequest user) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth(token);

        // lldap GraphQL API for creating users
        Map<String, Object> variables = new HashMap<>();
        Map<String, Object> userInput = new HashMap<>();
        userInput.put("id", user.getUsername());
        userInput.put("email", user.getEmail());
        userInput.put("displayName", user.getDisplayName() != null ? user.getDisplayName() : user.getUsername());
        variables.put("user", userInput);

        Map<String, Object> graphql = new HashMap<>();
        graphql.put("query", "mutation CreateUser($user: CreateUserInput!) { createUser(user: $user) { id email displayName } }");
        graphql.put("variables", variables);

        HttpEntity<Map<String, Object>> request = new HttpEntity<>(graphql, headers);
        ResponseEntity<Map> response = restTemplate.postForEntity(ldapApiUrl + "/api/graphql", request, Map.class);

        if (!response.getStatusCode().is2xxSuccessful()) {
            throw new RuntimeException("Failed to create LDAP user: " + response.getStatusCode());
        }

        // Check for GraphQL errors
        Map body = response.getBody();
        if (body != null && body.containsKey("errors")) {
            throw new RuntimeException("LDAP error: " + body.get("errors").toString());
        }
    }

    private void addUserToGroup(String token, String username, String group) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth(token);

        Map<String, Object> variables = new HashMap<>();
        variables.put("userId", username);
        variables.put("groupId", resolveGroupId(token, group));

        Map<String, Object> graphql = new HashMap<>();
        graphql.put("query", "mutation AddUserToGroup($userId: String!, $groupId: Int!) { addUserToGroup(userId: $userId, groupId: $groupId) { ok } }");
        graphql.put("variables", variables);

        HttpEntity<Map<String, Object>> request = new HttpEntity<>(graphql, headers);
        restTemplate.postForEntity(ldapApiUrl + "/api/graphql", request, Map.class);
    }

    private int resolveGroupId(String token, String groupName) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth(token);

        Map<String, Object> graphql = new HashMap<>();
        graphql.put("query", "{ groups { id displayName } }");

        HttpEntity<Map<String, Object>> request = new HttpEntity<>(graphql, headers);
        ResponseEntity<Map> response = restTemplate.postForEntity(ldapApiUrl + "/api/graphql", request, Map.class);

        if (response.getBody() != null) {
            Map data = (Map) response.getBody().get("data");
            if (data != null) {
                List<Map> groups = (List<Map>) data.get("groups");
                if (groups != null) {
                    for (Map g : groups) {
                        if (groupName.equalsIgnoreCase((String) g.get("displayName"))) {
                            return (int) g.get("id");
                        }
                    }
                }
            }
        }
        throw new RuntimeException("LDAP group not found: " + groupName);
    }

    private void logSync(String companyId, String action, String username, String group,
                          String status, String error, String performedBy) {
        LdapSyncLog logEntry = new LdapSyncLog();
        logEntry.setId(UUID.randomUUID().toString());
        logEntry.setCompanyId(companyId);
        logEntry.setAction(action);
        logEntry.setUsername(username);
        logEntry.setLdapGroup(group);
        logEntry.setStatus(status);
        logEntry.setErrorMessage(error);
        logEntry.setPerformedBy(performedBy);
        logEntry.setPerformedAt(LocalDateTime.now());
        syncLogRepository.save(logEntry);
    }
}
