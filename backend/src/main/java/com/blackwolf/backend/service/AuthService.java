package com.blackwolf.backend.service;

import com.blackwolf.backend.dto.AuthDTOs.*;
import com.blackwolf.backend.model.Company;
import com.blackwolf.backend.model.LoginAttempt;
import com.blackwolf.backend.model.RefreshToken;
import com.blackwolf.backend.model.User;
import com.blackwolf.backend.repository.CompanyRepository;
import com.blackwolf.backend.repository.UserRepository;
import com.blackwolf.backend.security.JwtTokenProvider;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.UUID;

@Service
public class AuthService {

    private static final Logger log = LoggerFactory.getLogger(AuthService.class);

    @Autowired
    private AuthenticationManager authenticationManager;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private CompanyRepository companyRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private JwtTokenProvider tokenProvider;

    @Autowired
    private RefreshTokenService refreshTokenService;

    @Autowired
    private RateLimitService rateLimitService;

    @Value("${jwt.expiration}")
    private int jwtExpirationInMs;

    @Transactional
    public AuthResponse login(LoginRequest loginRequest, String ipAddress) {
        String identifier = loginRequest.getEmail() + ":" +
                (loginRequest.getCompanyDomain() != null ? loginRequest.getCompanyDomain() : "superadmin");

        // Check rate limit
        rateLimitService.checkRateLimit(identifier, ipAddress, LoginAttempt.AttemptType.LOGIN);

        User user;

        try {
            // Superadmin login: no company domain
            if (loginRequest.getCompanyDomain() == null || loginRequest.getCompanyDomain().isBlank()) {
                user = userRepository.findByEmailAndCompanyIdIsNull(loginRequest.getEmail())
                        .orElseThrow(() -> new RuntimeException("Invalid credentials"));
                if (!"superadmin".equals(user.getRole())) {
                    throw new RuntimeException("Invalid credentials");
                }
            } else {
                // Regular login: find company first
                Company company = companyRepository.findByDomain(loginRequest.getCompanyDomain())
                        .orElseThrow(() -> new RuntimeException("Invalid credentials"));
                user = userRepository.findByEmailAndCompanyId(loginRequest.getEmail(), company.getId())
                        .orElseThrow(() -> new RuntimeException("Invalid credentials"));
            }

            if (!user.isActive()) {
                throw new RuntimeException("Account is disabled");
            }

            Authentication authentication = authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(
                            user.getId(),
                            loginRequest.getPassword()));

            SecurityContextHolder.getContext().setAuthentication(authentication);
            String jwt = tokenProvider.generateToken(authentication);

            // Create refresh token
            RefreshToken refreshToken = refreshTokenService.createRefreshToken(user.getId(), ipAddress);

            // Update last login
            user.setLastLogin(LocalDateTime.now());
            userRepository.save(user);

            // Record successful attempt
            rateLimitService.recordAttempt(identifier, ipAddress, LoginAttempt.AttemptType.LOGIN, true);

            log.info("User {} logged in successfully from IP {}", user.getEmail(), ipAddress);

            return new AuthResponse(jwt, refreshToken.getToken(), jwtExpirationInMs / 1000, user);

        } catch (Exception e) {
            // Record failed attempt
            rateLimitService.recordAttempt(identifier, ipAddress, LoginAttempt.AttemptType.LOGIN, false);
            log.warn("Failed login attempt for {} from IP {}", identifier, ipAddress);
            throw new RuntimeException("Invalid credentials");
        }
    }

    @Transactional
    public AuthResponse refreshToken(String refreshTokenValue, String ipAddress) {
        RefreshToken oldRefreshToken = refreshTokenService.validateRefreshToken(refreshTokenValue);

        User user = userRepository.findById(oldRefreshToken.getUserId())
                .orElseThrow(() -> new RuntimeException("User not found"));

        if (!user.isActive()) {
            refreshTokenService.revokeAllUserTokens(user.getId());
            throw new RuntimeException("Account is disabled");
        }

        // Rotate refresh token
        RefreshToken newRefreshToken = refreshTokenService.rotateRefreshToken(refreshTokenValue, ipAddress);

        // Generate new access token
        String role = "ROLE_" + user.getRole().toUpperCase();
        String jwt = tokenProvider.generateTokenForUser(user.getId(), role);

        return new AuthResponse(jwt, newRefreshToken.getToken(), jwtExpirationInMs / 1000, user);
    }

    @Transactional
    public void logout(String refreshTokenValue) {
        if (refreshTokenValue != null) {
            refreshTokenService.revokeToken(refreshTokenValue);
        }
    }

    @Transactional
    public void logoutAll(String userId) {
        refreshTokenService.revokeAllUserTokens(userId);
    }

    public void changePassword(String userId, ChangePasswordRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        if (!passwordEncoder.matches(request.getCurrentPassword(), user.getPassword())) {
            throw new RuntimeException("Current password is incorrect");
        }

        user.setPassword(passwordEncoder.encode(request.getNewPassword()));
        userRepository.save(user);

        // Revoke all refresh tokens on password change
        refreshTokenService.revokeAllUserTokens(userId);
        log.info("Password changed for user {}. All sessions revoked.", userId);
    }

    @Transactional
    public Company register(RegisterRequest registerRequest, String ipAddress) {
        String identifier = registerRequest.getDomain();

        // Check rate limit
        rateLimitService.checkRateLimit(identifier, ipAddress, LoginAttempt.AttemptType.REGISTER);

        if (companyRepository.findByDomain(registerRequest.getDomain()).isPresent()) {
            rateLimitService.recordAttempt(identifier, ipAddress, LoginAttempt.AttemptType.REGISTER, false);
            throw new RuntimeException("Company already registered");
        }

        Company company = new Company();
        company.setId(UUID.randomUUID().toString());
        company.setCompanyName(registerRequest.getCompanyName());
        company.setDomain(registerRequest.getDomain());
        company.setContactEmail(registerRequest.getContactEmail());
        company.setContactPhone(registerRequest.getContactPhone());
        company.setPlan(registerRequest.getPlan());
        company.setApiKey(UUID.randomUUID().toString());
        company.setStatus("active");
        company.setRegisteredAt(LocalDateTime.now());
        company.setTotalThreats(0L);

        company = companyRepository.save(company);

        // Create Admin User with the provided password
        User admin = new User();
        admin.setId(UUID.randomUUID().toString());
        admin.setEmail(registerRequest.getContactEmail());
        admin.setFullName("Admin");
        admin.setCompanyId(company.getId());
        admin.setRole("admin");
        admin.setActive(true);
        admin.setCreatedAt(LocalDateTime.now());
        admin.setPassword(passwordEncoder.encode(registerRequest.getPassword()));

        userRepository.save(admin);

        rateLimitService.recordAttempt(identifier, ipAddress, LoginAttempt.AttemptType.REGISTER, true);
        log.info("New company registered: {} ({})", company.getCompanyName(), company.getDomain());

        return company;
    }
}
