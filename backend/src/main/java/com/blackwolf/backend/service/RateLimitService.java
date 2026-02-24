package com.blackwolf.backend.service;

import com.blackwolf.backend.model.LoginAttempt;
import com.blackwolf.backend.repository.LoginAttemptRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDateTime;

@Service
public class RateLimitService {

    private static final Logger log = LoggerFactory.getLogger(RateLimitService.class);

    private static final int MAX_LOGIN_ATTEMPTS = 5;
    private static final int LOGIN_WINDOW_MINUTES = 15;
    private static final int MAX_REGISTER_ATTEMPTS = 3;
    private static final int REGISTER_WINDOW_MINUTES = 60;
    private static final int MAX_IP_ATTEMPTS = 20;
    private static final int IP_WINDOW_MINUTES = 15;
    private static final int MAX_API_REQUESTS = 100;
    private static final int API_WINDOW_MINUTES = 1;

    private static final String REDIS_PREFIX = "rate:";

    @Autowired
    private LoginAttemptRepository loginAttemptRepository;

    @Autowired(required = false)
    private StringRedisTemplate redisTemplate;

    public void checkRateLimit(String identifier, String ipAddress, LoginAttempt.AttemptType type) {
        int maxAttempts = getMaxAttempts(type);
        int windowMinutes = getWindowMinutes(type);

        // Try Redis first (fast path)
        if (redisTemplate != null) {
            try {
                String key = REDIS_PREFIX + type.name().toLowerCase() + ":" + identifier;
                if (!checkRedisRate(key, maxAttempts, Duration.ofMinutes(windowMinutes))) {
                    log.warn("Rate limit exceeded (Redis) for identifier: {} type: {}", identifier, type);
                    throw new RateLimitExceededException(
                            "Too many attempts. Try again in " + windowMinutes + " minutes.");
                }
                if (ipAddress != null) {
                    String ipKey = REDIS_PREFIX + "ip:" + type.name().toLowerCase() + ":" + ipAddress;
                    if (!checkRedisRate(ipKey, MAX_IP_ATTEMPTS, Duration.ofMinutes(IP_WINDOW_MINUTES))) {
                        log.warn("Rate limit exceeded (Redis) for IP: {} type: {}", ipAddress, type);
                        throw new RateLimitExceededException(
                                "Too many attempts from this IP. Try again later.");
                    }
                }
                return;
            } catch (RateLimitExceededException e) {
                throw e;
            } catch (Exception e) {
                log.warn("Redis rate limit check failed, falling back to DB: {}", e.getMessage());
            }
        }

        // Fallback to MySQL
        LocalDateTime window = LocalDateTime.now().minusMinutes(windowMinutes);

        long identifierAttempts = loginAttemptRepository
                .countByIdentifierAndAttemptTypeAndSuccessFalseAndAttemptedAtAfter(identifier, type, window);

        if (identifierAttempts >= maxAttempts) {
            log.warn("Rate limit exceeded for identifier: {} type: {}", identifier, type);
            throw new RateLimitExceededException(
                    "Too many attempts. Try again in " + windowMinutes + " minutes.");
        }

        if (ipAddress != null) {
            long ipAttempts = loginAttemptRepository
                    .countByIpAddressAndAttemptTypeAndSuccessFalseAndAttemptedAtAfter(ipAddress, type, window);
            if (ipAttempts >= MAX_IP_ATTEMPTS) {
                log.warn("Rate limit exceeded for IP: {} type: {}", ipAddress, type);
                throw new RateLimitExceededException(
                        "Too many attempts from this IP. Try again later.");
            }
        }
    }

    public void recordAttempt(String identifier, String ipAddress, LoginAttempt.AttemptType type, boolean success) {
        // Always persist to MySQL for audit trail
        LoginAttempt attempt = new LoginAttempt();
        attempt.setIdentifier(identifier);
        attempt.setIpAddress(ipAddress);
        attempt.setAttemptType(type);
        attempt.setSuccess(success);
        attempt.setAttemptedAt(LocalDateTime.now());
        loginAttemptRepository.save(attempt);

        // Reset Redis counter on success
        if (success && redisTemplate != null) {
            try {
                String key = REDIS_PREFIX + type.name().toLowerCase() + ":" + identifier;
                redisTemplate.delete(key);
            } catch (Exception e) {
                log.warn("Failed to reset Redis rate limit counter: {}", e.getMessage());
            }
        }
    }

    /**
     * Check API rate limit (Redis only, no MySQL audit).
     */
    public boolean checkApiRate(String apiKeyPrefix) {
        if (redisTemplate == null) return true;
        try {
            String key = REDIS_PREFIX + "api:" + apiKeyPrefix;
            return checkRedisRate(key, MAX_API_REQUESTS, Duration.ofMinutes(API_WINDOW_MINUTES));
        } catch (Exception e) {
            log.warn("Redis API rate check failed, allowing: {}", e.getMessage());
            return true;
        }
    }

    private boolean checkRedisRate(String key, int maxAttempts, Duration window) {
        Long count = redisTemplate.opsForValue().increment(key);
        if (count != null && count == 1) {
            redisTemplate.expire(key, window);
        }
        return count != null && count <= maxAttempts;
    }

    private int getMaxAttempts(LoginAttempt.AttemptType type) {
        return switch (type) {
            case LOGIN -> MAX_LOGIN_ATTEMPTS;
            case REGISTER -> MAX_REGISTER_ATTEMPTS;
            default -> MAX_IP_ATTEMPTS;
        };
    }

    private int getWindowMinutes(LoginAttempt.AttemptType type) {
        return switch (type) {
            case LOGIN -> LOGIN_WINDOW_MINUTES;
            case REGISTER -> REGISTER_WINDOW_MINUTES;
            default -> IP_WINDOW_MINUTES;
        };
    }

    @Scheduled(fixedRate = 3600000) // Every hour
    @Transactional
    public void cleanupOldAttempts() {
        loginAttemptRepository.deleteOlderThan(LocalDateTime.now().minusHours(24));
    }

    public static class RateLimitExceededException extends RuntimeException {
        public RateLimitExceededException(String message) {
            super(message);
        }
    }
}
