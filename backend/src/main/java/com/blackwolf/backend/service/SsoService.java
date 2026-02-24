package com.blackwolf.backend.service;

import com.blackwolf.backend.model.Company;
import com.blackwolf.backend.model.SsoConfiguration;
import com.blackwolf.backend.model.User;
import com.blackwolf.backend.repository.CompanyRepository;
import com.blackwolf.backend.repository.SsoConfigurationRepository;
import com.blackwolf.backend.repository.UserRepository;
import com.blackwolf.backend.security.JwtTokenProvider;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;

import java.time.LocalDateTime;
import java.util.*;

@Service
public class SsoService {

    private static final Logger log = LoggerFactory.getLogger(SsoService.class);

    @Autowired
    private SsoConfigurationRepository ssoConfigRepository;

    @Autowired
    private CompanyRepository companyRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private JwtTokenProvider tokenProvider;

    @Autowired
    private RefreshTokenService refreshTokenService;

    @Autowired
    private RbacService rbacService;

    private final RestTemplate restTemplate = new RestTemplate();

    // ===== SSO Config CRUD =====

    public Optional<SsoConfiguration> getConfig(String companyId) {
        return ssoConfigRepository.findByCompanyId(companyId);
    }

    @Transactional
    public SsoConfiguration saveConfig(String companyId, SsoConfiguration config) {
        Optional<SsoConfiguration> existing = ssoConfigRepository.findByCompanyId(companyId);

        SsoConfiguration sso;
        if (existing.isPresent()) {
            sso = existing.get();
            sso.setProvider(config.getProvider());
            sso.setClientId(config.getClientId());
            if (config.getClientSecret() != null && !config.getClientSecret().isBlank()) {
                sso.setClientSecret(config.getClientSecret());
            }
            sso.setIssuerUrl(config.getIssuerUrl());
            sso.setAutoProvisionUsers(config.isAutoProvisionUsers());
            sso.setDefaultRole(config.getDefaultRole());
            sso.setAllowedDomains(config.getAllowedDomains());
            sso.setUpdatedAt(LocalDateTime.now());
        } else {
            sso = config;
            sso.setId(UUID.randomUUID().toString());
            sso.setCompanyId(companyId);
            sso.setCreatedAt(LocalDateTime.now());
            sso.setUpdatedAt(LocalDateTime.now());
        }

        return ssoConfigRepository.save(sso);
    }

    @Transactional
    public SsoConfiguration toggleActive(String companyId, boolean active) {
        SsoConfiguration sso = ssoConfigRepository.findByCompanyId(companyId)
                .orElseThrow(() -> new RuntimeException("SSO not configured"));
        sso.setActive(active);
        sso.setUpdatedAt(LocalDateTime.now());
        return ssoConfigRepository.save(sso);
    }

    @Transactional
    public void deleteConfig(String companyId) {
        ssoConfigRepository.findByCompanyId(companyId)
                .ifPresent(ssoConfigRepository::delete);
    }

    // ===== OIDC Flow =====

    /**
     * Build the authorization URL to redirect the user to the OIDC provider.
     */
    public String buildAuthorizationUrl(String companyDomain, String redirectUri, String state) {
        Company company = companyRepository.findByDomain(companyDomain)
                .orElseThrow(() -> new RuntimeException("Company not found"));

        SsoConfiguration sso = ssoConfigRepository.findByCompanyIdAndIsActiveTrue(company.getId())
                .orElseThrow(() -> new RuntimeException("SSO not configured or not active for this company"));

        String authEndpoint = discoverAuthEndpoint(sso.getIssuerUrl());

        return authEndpoint + "?" +
                "client_id=" + sso.getClientId() +
                "&response_type=code" +
                "&scope=openid%20profile%20email" +
                "&redirect_uri=" + redirectUri +
                "&state=" + state;
    }

    /**
     * Exchange the authorization code for tokens, extract user info, and issue JWT.
     */
    @Transactional
    @SuppressWarnings("unchecked")
    public Map<String, Object> handleCallback(String companyDomain, String code, String redirectUri, String ipAddress) {
        Company company = companyRepository.findByDomain(companyDomain)
                .orElseThrow(() -> new RuntimeException("Company not found"));

        SsoConfiguration sso = ssoConfigRepository.findByCompanyIdAndIsActiveTrue(company.getId())
                .orElseThrow(() -> new RuntimeException("SSO not configured or not active"));

        // 1. Exchange code for tokens
        String tokenEndpoint = discoverTokenEndpoint(sso.getIssuerUrl());

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);

        MultiValueMap<String, String> body = new LinkedMultiValueMap<>();
        body.add("grant_type", "authorization_code");
        body.add("code", code);
        body.add("redirect_uri", redirectUri);
        body.add("client_id", sso.getClientId());
        body.add("client_secret", sso.getClientSecret());

        HttpEntity<MultiValueMap<String, String>> request = new HttpEntity<>(body, headers);
        ResponseEntity<Map> tokenResponse = restTemplate.exchange(tokenEndpoint, HttpMethod.POST, request, Map.class);

        Map<String, Object> tokenData = tokenResponse.getBody();
        if (tokenData == null || !tokenData.containsKey("access_token")) {
            throw new RuntimeException("Failed to exchange authorization code");
        }

        // 2. Get user info
        String userInfoEndpoint = discoverUserInfoEndpoint(sso.getIssuerUrl());

        HttpHeaders userInfoHeaders = new HttpHeaders();
        userInfoHeaders.setBearerAuth((String) tokenData.get("access_token"));
        HttpEntity<Void> userInfoRequest = new HttpEntity<>(userInfoHeaders);

        ResponseEntity<Map> userInfoResponse = restTemplate.exchange(userInfoEndpoint, HttpMethod.GET, userInfoRequest, Map.class);
        Map<String, Object> userInfo = userInfoResponse.getBody();

        if (userInfo == null || !userInfo.containsKey("email")) {
            throw new RuntimeException("Failed to get user info from SSO provider");
        }

        String email = (String) userInfo.get("email");
        String name = (String) userInfo.getOrDefault("name",
                userInfo.getOrDefault("given_name", "") + " " + userInfo.getOrDefault("family_name", ""));

        // 3. Validate email domain if restrictions are set
        if (sso.getAllowedDomains() != null && !sso.getAllowedDomains().isBlank()) {
            String emailDomain = email.substring(email.indexOf('@') + 1);
            boolean allowed = Arrays.stream(sso.getAllowedDomains().split(","))
                    .map(String::trim)
                    .anyMatch(d -> d.equalsIgnoreCase(emailDomain));
            if (!allowed) {
                throw new RuntimeException("Email domain not allowed for SSO login");
            }
        }

        // 4. Find or create user
        User user = userRepository.findByEmailAndCompanyId(email, company.getId())
                .orElseGet(() -> {
                    if (!sso.isAutoProvisionUsers()) {
                        throw new RuntimeException("User not found and auto-provisioning is disabled");
                    }
                    // Auto-provision new user
                    User newUser = new User();
                    newUser.setId(UUID.randomUUID().toString());
                    newUser.setEmail(email);
                    newUser.setFullName(name != null ? name.trim() : email);
                    newUser.setCompanyId(company.getId());
                    newUser.setRole(sso.getDefaultRole() != null ? sso.getDefaultRole() : "analyst");
                    newUser.setActive(true);
                    newUser.setPassword(""); // SSO users don't need a password
                    newUser.setCreatedAt(LocalDateTime.now());
                    log.info("Auto-provisioned SSO user: {} for company {}", email, company.getCompanyName());
                    return userRepository.save(newUser);
                });

        if (!user.isActive()) {
            throw new RuntimeException("Account is disabled");
        }

        // 5. Issue JWT
        String role = "ROLE_" + user.getRole().toUpperCase();
        String jwt = tokenProvider.generateTokenForUser(user.getId(), role);
        var refreshToken = refreshTokenService.createRefreshToken(user.getId(), ipAddress);

        user.setLastLogin(LocalDateTime.now());
        userRepository.save(user);

        List<String> permissions = new ArrayList<>(rbacService.getPermissionsForRole(user.getRole(), user.getCompanyId()));

        log.info("SSO login successful for {} ({}) from IP {}", email, company.getCompanyName(), ipAddress);

        Map<String, Object> result = new HashMap<>();
        result.put("accessToken", jwt);
        result.put("refreshToken", refreshToken.getToken());
        result.put("expiresIn", tokenProvider.getExpirationMs() / 1000);
        result.put("user", user);
        result.put("permissions", permissions);
        return result;
    }

    /**
     * Check if SSO is enabled for a given company domain.
     */
    public boolean isSsoEnabled(String companyDomain) {
        return companyRepository.findByDomain(companyDomain)
                .flatMap(c -> ssoConfigRepository.findByCompanyIdAndIsActiveTrue(c.getId()))
                .isPresent();
    }

    /**
     * Test SSO connection by fetching the OIDC discovery document.
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> testConnection(String issuerUrl) {
        try {
            String discoveryUrl = issuerUrl.endsWith("/")
                    ? issuerUrl + ".well-known/openid-configuration"
                    : issuerUrl + "/.well-known/openid-configuration";

            ResponseEntity<Map> response = restTemplate.getForEntity(discoveryUrl, Map.class);
            Map<String, Object> discovery = response.getBody();

            Map<String, Object> result = new HashMap<>();
            result.put("success", true);
            result.put("issuer", discovery != null ? discovery.get("issuer") : null);
            result.put("authorization_endpoint", discovery != null ? discovery.get("authorization_endpoint") : null);
            result.put("token_endpoint", discovery != null ? discovery.get("token_endpoint") : null);
            return result;
        } catch (Exception e) {
            Map<String, Object> result = new HashMap<>();
            result.put("success", false);
            result.put("error", e.getMessage());
            return result;
        }
    }

    // ===== OIDC Discovery =====

    @SuppressWarnings("unchecked")
    private Map<String, Object> getDiscoveryDocument(String issuerUrl) {
        String discoveryUrl = issuerUrl.endsWith("/")
                ? issuerUrl + ".well-known/openid-configuration"
                : issuerUrl + "/.well-known/openid-configuration";
        ResponseEntity<Map> response = restTemplate.getForEntity(discoveryUrl, Map.class);
        return response.getBody();
    }

    private String discoverAuthEndpoint(String issuerUrl) {
        Map<String, Object> doc = getDiscoveryDocument(issuerUrl);
        return (String) doc.get("authorization_endpoint");
    }

    private String discoverTokenEndpoint(String issuerUrl) {
        Map<String, Object> doc = getDiscoveryDocument(issuerUrl);
        return (String) doc.get("token_endpoint");
    }

    private String discoverUserInfoEndpoint(String issuerUrl) {
        Map<String, Object> doc = getDiscoveryDocument(issuerUrl);
        return (String) doc.get("userinfo_endpoint");
    }
}
