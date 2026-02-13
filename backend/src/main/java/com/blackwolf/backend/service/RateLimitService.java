package com.blackwolf.backend.service;

import com.blackwolf.backend.model.LoginAttempt;
import com.blackwolf.backend.repository.LoginAttemptRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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

    @Autowired
    private LoginAttemptRepository loginAttemptRepository;

    public void checkRateLimit(String identifier, String ipAddress, LoginAttempt.AttemptType type) {
        LocalDateTime window;
        int maxAttempts;

        switch (type) {
            case LOGIN -> {
                window = LocalDateTime.now().minusMinutes(LOGIN_WINDOW_MINUTES);
                maxAttempts = MAX_LOGIN_ATTEMPTS;
            }
            case REGISTER -> {
                window = LocalDateTime.now().minusMinutes(REGISTER_WINDOW_MINUTES);
                maxAttempts = MAX_REGISTER_ATTEMPTS;
            }
            default -> {
                window = LocalDateTime.now().minusMinutes(IP_WINDOW_MINUTES);
                maxAttempts = MAX_IP_ATTEMPTS;
            }
        }

        // Check by identifier (email/domain combo)
        long identifierAttempts = loginAttemptRepository
                .countByIdentifierAndAttemptTypeAndSuccessFalseAndAttemptedAtAfter(identifier, type, window);

        if (identifierAttempts >= maxAttempts) {
            log.warn("Rate limit exceeded for identifier: {} type: {}", identifier, type);
            throw new RateLimitExceededException(
                    "Too many attempts. Try again in " + getWindowMinutes(type) + " minutes.");
        }

        // Check by IP
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
        LoginAttempt attempt = new LoginAttempt();
        attempt.setIdentifier(identifier);
        attempt.setIpAddress(ipAddress);
        attempt.setAttemptType(type);
        attempt.setSuccess(success);
        attempt.setAttemptedAt(LocalDateTime.now());
        loginAttemptRepository.save(attempt);
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
