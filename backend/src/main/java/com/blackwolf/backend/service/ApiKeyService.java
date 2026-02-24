package com.blackwolf.backend.service;

import com.blackwolf.backend.model.ApiKey;
import com.blackwolf.backend.repository.ApiKeyRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
public class ApiKeyService {

    private static final Logger log = LoggerFactory.getLogger(ApiKeyService.class);
    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

    @Autowired
    private ApiKeyRepository apiKeyRepository;

    /**
     * Create a new API key. Returns the raw key (only shown once).
     */
    @Transactional
    public CreateKeyResult createApiKey(String companyId, String name, String scopes, String createdBy) {
        String rawKey = generateRawKey();
        String prefix = rawKey.substring(0, 8);
        String hash = sha256(rawKey);

        ApiKey apiKey = new ApiKey();
        apiKey.setId(UUID.randomUUID().toString());
        apiKey.setCompanyId(companyId);
        apiKey.setName(name);
        apiKey.setKeyPrefix(prefix);
        apiKey.setKeyHash(hash);
        apiKey.setScopes(scopes != null ? scopes : "sensor:upload");
        apiKey.setActive(true);
        apiKey.setCreatedBy(createdBy);
        apiKey.setCreatedAt(LocalDateTime.now());
        apiKeyRepository.save(apiKey);

        log.info("API key created: {} (prefix: {}...) for company {}", name, prefix, companyId);
        return new CreateKeyResult(apiKey, rawKey);
    }

    /**
     * List all API keys for a company (hashes hidden via @JsonIgnore).
     */
    public List<ApiKey> listByCompany(String companyId) {
        return apiKeyRepository.findByCompanyIdOrderByCreatedAtDesc(companyId);
    }

    /**
     * Revoke (deactivate) an API key.
     */
    @Transactional
    public ApiKey revokeKey(String keyId, String companyId) {
        ApiKey key = apiKeyRepository.findById(keyId)
                .orElseThrow(() -> new RuntimeException("API key not found"));
        if (!key.getCompanyId().equals(companyId)) {
            throw new RuntimeException("Access denied");
        }
        key.setActive(false);
        return apiKeyRepository.save(key);
    }

    /**
     * Rotate an API key: revoke old, create new with same name/scopes.
     */
    @Transactional
    public CreateKeyResult rotateKey(String keyId, String companyId, String performedBy) {
        ApiKey old = apiKeyRepository.findById(keyId)
                .orElseThrow(() -> new RuntimeException("API key not found"));
        if (!old.getCompanyId().equals(companyId)) {
            throw new RuntimeException("Access denied");
        }
        old.setActive(false);
        apiKeyRepository.save(old);

        return createApiKey(companyId, old.getName() + " (rotated)", old.getScopes(), performedBy);
    }

    /**
     * Validate an API key. Returns the company ID if valid, empty if invalid.
     */
    @Transactional
    public Optional<String> validateKey(String rawKey) {
        String hash = sha256(rawKey);
        Optional<ApiKey> keyOpt = apiKeyRepository.findByKeyHash(hash);

        if (keyOpt.isEmpty()) return Optional.empty();

        ApiKey key = keyOpt.get();
        if (!key.isActive()) return Optional.empty();
        if (key.getExpiresAt() != null && key.getExpiresAt().isBefore(LocalDateTime.now())) {
            return Optional.empty();
        }

        // Update last used
        key.setLastUsedAt(LocalDateTime.now());
        apiKeyRepository.save(key);

        return Optional.of(key.getCompanyId());
    }

    /**
     * Delete an API key permanently.
     */
    @Transactional
    public void deleteKey(String keyId, String companyId) {
        ApiKey key = apiKeyRepository.findById(keyId)
                .orElseThrow(() -> new RuntimeException("API key not found"));
        if (!key.getCompanyId().equals(companyId)) {
            throw new RuntimeException("Access denied");
        }
        apiKeyRepository.delete(key);
    }

    private String generateRawKey() {
        byte[] bytes = new byte[32];
        SECURE_RANDOM.nextBytes(bytes);
        return "bw_" + Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private String sha256(String input) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(input.getBytes(StandardCharsets.UTF_8));
            StringBuilder hex = new StringBuilder();
            for (byte b : hash) {
                hex.append(String.format("%02x", b));
            }
            return hex.toString();
        } catch (Exception e) {
            throw new RuntimeException("SHA-256 not available", e);
        }
    }

    /**
     * Result of creating an API key — includes the raw key shown only once.
     */
    public static class CreateKeyResult {
        private final ApiKey apiKey;
        private final String rawKey;

        public CreateKeyResult(ApiKey apiKey, String rawKey) {
            this.apiKey = apiKey;
            this.rawKey = rawKey;
        }

        public ApiKey getApiKey() { return apiKey; }
        public String getRawKey() { return rawKey; }
    }
}
