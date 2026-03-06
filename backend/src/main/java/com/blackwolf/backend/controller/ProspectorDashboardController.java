package com.blackwolf.backend.controller;

import com.blackwolf.backend.util.AuthUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;
import org.springframework.http.client.SimpleClientHttpRequestFactory;

import jakarta.annotation.PostConstruct;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/superadmin/bot")
public class ProspectorDashboardController {

    @Autowired
    private AuthUtils authUtils;

    @Value("${prospector.bot-url:http://linkedin-prospector:8000}")
    private String botUrl;

    @Value("${prospector.api-key:}")
    private String apiKey;

    private RestTemplate restTemplate;

    @PostConstruct
    public void init() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(10_000);
        factory.setReadTimeout(600_000);
        this.restTemplate = new RestTemplate(factory);
    }

    private void requireSuperAdmin(Authentication authentication) {
        if (!authUtils.isSuperAdmin(authentication)) {
            throw new RuntimeException("Access denied: superadmin role required");
        }
    }

    private HttpHeaders buildHeaders() {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        if (apiKey != null && !apiKey.isEmpty()) {
            headers.set("X-API-Key", apiKey);
        }
        return headers;
    }

    private ResponseEntity<String> proxyGet(String path) {
        try {
            HttpEntity<Void> entity = new HttpEntity<>(buildHeaders());
            ResponseEntity<String> response = restTemplate.exchange(
                    botUrl + path, HttpMethod.GET, entity, String.class);
            return ResponseEntity.status(response.getStatusCode())
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(response.getBody());
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body("{\"error\":\"Bot not reachable\",\"detail\":\"" +
                            e.getMessage().replace("\"", "'") + "\"}");
        }
    }

    private ResponseEntity<String> proxyPost(String path, Object body) {
        try {
            HttpEntity<Object> entity = new HttpEntity<>(body, buildHeaders());
            ResponseEntity<String> response = restTemplate.exchange(
                    botUrl + path, HttpMethod.POST, entity, String.class);
            return ResponseEntity.status(response.getStatusCode())
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(response.getBody());
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body("{\"error\":\"Bot not reachable\",\"detail\":\"" +
                            e.getMessage().replace("\"", "'") + "\"}");
        }
    }

    @GetMapping("/health")
    public ResponseEntity<String> health(Authentication auth) {
        requireSuperAdmin(auth);
        return proxyGet("/health");
    }

    @GetMapping("/status")
    public ResponseEntity<String> status(Authentication auth) {
        requireSuperAdmin(auth);
        return proxyGet("/status");
    }

    @PostMapping("/search")
    public ResponseEntity<String> search(Authentication auth) {
        requireSuperAdmin(auth);
        return proxyPost("/search", Map.of());
    }

    @PostMapping("/followup")
    public ResponseEntity<String> followup(Authentication auth) {
        requireSuperAdmin(auth);
        return proxyPost("/followup", Map.of());
    }

    @PostMapping("/publish")
    public ResponseEntity<String> publish(Authentication auth) {
        requireSuperAdmin(auth);
        return proxyPost("/publish", Map.of());
    }

    @PostMapping("/pause")
    public ResponseEntity<String> pause(Authentication auth) {
        requireSuperAdmin(auth);
        return proxyPost("/pause", Map.of());
    }

    @PostMapping("/resume")
    public ResponseEntity<String> resume(Authentication auth) {
        requireSuperAdmin(auth);
        return proxyPost("/resume", Map.of());
    }

    @PostMapping("/relogin")
    public ResponseEntity<String> relogin(Authentication auth) {
        requireSuperAdmin(auth);
        return proxyPost("/relogin", Map.of());
    }

    @PostMapping("/cookies")
    public ResponseEntity<String> uploadCookies(Authentication auth, @RequestBody String cookies) {
        requireSuperAdmin(auth);
        return proxyPost("/cookies", cookies);
    }
}
