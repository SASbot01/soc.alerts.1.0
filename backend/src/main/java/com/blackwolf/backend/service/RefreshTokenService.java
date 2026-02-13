package com.blackwolf.backend.service;

import com.blackwolf.backend.model.RefreshToken;
import com.blackwolf.backend.repository.RefreshTokenRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.UUID;

@Service
public class RefreshTokenService {

    private static final Logger log = LoggerFactory.getLogger(RefreshTokenService.class);
    private static final SecureRandom secureRandom = new SecureRandom();

    @Value("${jwt.refresh-expiration-days:7}")
    private int refreshExpirationDays;

    @Autowired
    private RefreshTokenRepository refreshTokenRepository;

    @Transactional
    public RefreshToken createRefreshToken(String userId, String ipAddress) {
        RefreshToken refreshToken = new RefreshToken();
        refreshToken.setId(UUID.randomUUID().toString());
        refreshToken.setUserId(userId);
        refreshToken.setToken(generateSecureToken());
        refreshToken.setExpiresAt(LocalDateTime.now().plusDays(refreshExpirationDays));
        refreshToken.setRevoked(false);
        refreshToken.setCreatedAt(LocalDateTime.now());
        refreshToken.setCreatedByIp(ipAddress);

        return refreshTokenRepository.save(refreshToken);
    }

    @Transactional
    public RefreshToken rotateRefreshToken(String oldToken, String ipAddress) {
        RefreshToken existing = refreshTokenRepository.findByToken(oldToken)
                .orElseThrow(() -> new RuntimeException("Invalid refresh token"));

        if (!existing.isActive()) {
            // Token reuse detected - revoke all tokens for this user
            refreshTokenRepository.revokeAllByUserId(existing.getUserId());
            log.warn("Refresh token reuse detected for user: {}. All tokens revoked.", existing.getUserId());
            throw new RuntimeException("Invalid refresh token - possible token theft detected");
        }

        // Revoke old token
        existing.setRevoked(true);
        String newTokenValue = generateSecureToken();
        existing.setReplacedBy(newTokenValue);
        refreshTokenRepository.save(existing);

        // Create new token
        RefreshToken newToken = new RefreshToken();
        newToken.setId(UUID.randomUUID().toString());
        newToken.setUserId(existing.getUserId());
        newToken.setToken(newTokenValue);
        newToken.setExpiresAt(LocalDateTime.now().plusDays(refreshExpirationDays));
        newToken.setRevoked(false);
        newToken.setCreatedAt(LocalDateTime.now());
        newToken.setCreatedByIp(ipAddress);

        return refreshTokenRepository.save(newToken);
    }

    @Transactional
    public void revokeAllUserTokens(String userId) {
        refreshTokenRepository.revokeAllByUserId(userId);
    }

    @Transactional
    public void revokeToken(String token) {
        refreshTokenRepository.findByToken(token).ifPresent(rt -> {
            rt.setRevoked(true);
            refreshTokenRepository.save(rt);
        });
    }

    public RefreshToken validateRefreshToken(String token) {
        RefreshToken refreshToken = refreshTokenRepository.findByToken(token)
                .orElseThrow(() -> new RuntimeException("Invalid refresh token"));

        if (!refreshToken.isActive()) {
            throw new RuntimeException("Refresh token expired or revoked");
        }

        return refreshToken;
    }

    private String generateSecureToken() {
        byte[] bytes = new byte[64];
        secureRandom.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    @Scheduled(fixedRate = 86400000) // Every 24 hours
    @Transactional
    public void cleanupExpiredTokens() {
        refreshTokenRepository.deleteExpiredAndRevoked(LocalDateTime.now());
        log.info("Cleaned up expired refresh tokens");
    }
}
