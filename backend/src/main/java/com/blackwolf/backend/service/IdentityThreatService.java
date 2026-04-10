package com.blackwolf.backend.service;

import com.blackwolf.backend.model.*;
import com.blackwolf.backend.repository.*;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.*;

@Service
@Slf4j
public class IdentityThreatService {

    @Autowired
    private IdentityEventRepository identityEventRepository;

    private static final int BRUTE_FORCE_THRESHOLD = 5;
    private static final int BRUTE_FORCE_WINDOW_MINUTES = 10;
    private static final int IMPOSSIBLE_TRAVEL_WINDOW_MINUTES = 30;

    public List<String> recordEvent(String companyId, IdentityEvent event) {
        event.setCompanyId(companyId);
        if (event.getTimestamp() == null) {
            event.setTimestamp(LocalDateTime.now());
        }
        identityEventRepository.save(event);

        List<String> detectedThreats = new ArrayList<>();

        // Brute force detection: >5 failed logins for same user in 10 min
        if (event.getUsername() != null && Boolean.FALSE.equals(event.getSuccess())) {
            LocalDateTime windowStart = event.getTimestamp().minusMinutes(BRUTE_FORCE_WINDOW_MINUTES);
            long failedCount = identityEventRepository.countByCompanyIdAndEventTypeAndTimestampAfter(
                    companyId, event.getEventType(), windowStart);
            // count failures for this specific user
            List<IdentityEvent> recentFailures = identityEventRepository
                    .findByCompanyIdAndUsernameAndEventTypeAndTimestampAfter(
                            companyId,
                            event.getUsername(),
                            event.getEventType(),
                            windowStart);
            long userFailures = recentFailures.stream()
                    .filter(e -> Boolean.FALSE.equals(e.getSuccess()))
                    .count();

            if (userFailures > BRUTE_FORCE_THRESHOLD) {
                String threat = "BRUTE_FORCE: user '" + event.getUsername()
                        + "' had " + userFailures + " failed logins in the last "
                        + BRUTE_FORCE_WINDOW_MINUTES + " minutes";
                log.warn("[ITDR] {}", threat);
                detectedThreats.add(threat);
            }
        }

        // Impossible travel: same user from different /16 subnets within 30 min
        if (event.getUsername() != null && event.getSourceIp() != null) {
            LocalDateTime travelWindowStart = event.getTimestamp().minusMinutes(IMPOSSIBLE_TRAVEL_WINDOW_MINUTES);
            List<IdentityEvent> recentUserEvents = identityEventRepository
                    .findByCompanyIdAndUsernameAndEventTypeAndTimestampAfter(
                            companyId,
                            event.getUsername(),
                            event.getEventType() != null ? event.getEventType() : "",
                            travelWindowStart);

            String currentSubnet16 = extractSubnet16(event.getSourceIp());
            if (currentSubnet16 != null) {
                boolean impossibleTravel = recentUserEvents.stream()
                        .filter(e -> e.getSourceIp() != null && !e.getId().equals(event.getId()))
                        .anyMatch(e -> {
                            String subnet = extractSubnet16(e.getSourceIp());
                            return subnet != null && !subnet.equals(currentSubnet16);
                        });

                if (impossibleTravel) {
                    String threat = "IMPOSSIBLE_TRAVEL: user '" + event.getUsername()
                            + "' seen from different /16 subnets within "
                            + IMPOSSIBLE_TRAVEL_WINDOW_MINUTES + " minutes";
                    log.warn("[ITDR] {}", threat);
                    detectedThreats.add(threat);
                }
            }
        }

        return detectedThreats;
    }

    public Page<IdentityEvent> getEvents(String companyId, LocalDateTime from, LocalDateTime to, Pageable pageable) {
        return identityEventRepository.findByCompanyIdAndTimestampBetween(
                companyId, from, to, pageable);
    }

    public Page<IdentityEvent> getUserActivity(String companyId, String username, Pageable pageable) {
        return identityEventRepository.findByCompanyIdAndUsername(
                companyId, username, pageable);
    }

    public Map<String, Object> getStats(String companyId) {
        LocalDateTime startOfDay = LocalDateTime.now().toLocalDate().atStartOfDay();

        long totalEventsToday = identityEventRepository
                .countByCompanyIdAndEventTypeAndTimestampAfter(companyId, "", startOfDay);
        // Count all today using a broad query
        List<IdentityEvent> todayEvents = identityEventRepository
                .findByCompanyIdAndTimestampBetween(companyId, startOfDay, LocalDateTime.now(),
                        org.springframework.data.domain.PageRequest.of(0, Integer.MAX_VALUE))
                .getContent();

        long failedLoginsToday = todayEvents.stream()
                .filter(e -> Boolean.FALSE.equals(e.getSuccess()))
                .count();
        long uniqueUsersToday = todayEvents.stream()
                .filter(e -> e.getUsername() != null)
                .map(IdentityEvent::getUsername)
                .distinct()
                .count();

        Map<String, Object> stats = new LinkedHashMap<>();
        stats.put("totalEventsToday", todayEvents.size());
        stats.put("failedLoginsToday", failedLoginsToday);
        stats.put("uniqueUsersToday", uniqueUsersToday);
        return stats;
    }

    // --- helpers ---

    private String extractSubnet16(String ip) {
        if (ip == null || !ip.contains(".")) return null;
        String[] parts = ip.split("\\.");
        if (parts.length < 2) return null;
        return parts[0] + "." + parts[1] + ".0.0/16";
    }
}
