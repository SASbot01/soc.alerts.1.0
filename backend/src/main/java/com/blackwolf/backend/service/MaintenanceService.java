package com.blackwolf.backend.service;

import com.blackwolf.backend.repository.BlockedIPRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

@Service
public class MaintenanceService {

    private static final Logger log = LoggerFactory.getLogger(MaintenanceService.class);

    @Autowired
    private BlockedIPRepository blockedIPRepository;

    @Value("${maintenance.cleanup-expired-ips.enabled:true}")
    private boolean cleanupEnabled;

    @Scheduled(fixedDelayString = "${maintenance.cleanup-expired-ips.interval-ms:3600000}")
    @Transactional
    public void cleanupExpiredIPs() {
        if (!cleanupEnabled) return;

        try {
            int deleted = blockedIPRepository.deleteExpired(LocalDateTime.now());
            if (deleted > 0) {
                log.info("Maintenance: Purged {} expired blocked IPs", deleted);
            }
        } catch (Exception e) {
            log.error("Maintenance: Failed to cleanup expired IPs: {}", e.getMessage());
        }
    }
}
