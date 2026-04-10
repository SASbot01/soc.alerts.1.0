package com.blackwolf.backend.service;

import com.blackwolf.backend.model.*;
import com.blackwolf.backend.repository.*;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

@Service
@Slf4j
public class SiemAnalyticsService {

    @Autowired
    private NormalizedLogRepository normalizedLogRepository;

    public List<Map<String, Object>> correlateEvents(String companyId, LocalDateTime from, LocalDateTime to) {
        log.debug("Correlating events for company {} from {} to {}", companyId, from, to);

        LocalDateTime startTime = (from != null) ? from : LocalDateTime.now().minusHours(24);
        LocalDateTime endTime = (to != null) ? to : LocalDateTime.now();

        // Fetch all logs in range (use a large page to get all)
        List<NormalizedLog> logs = normalizedLogRepository
                .findByCompanyIdAndTimestampBetween(companyId, startTime, endTime, PageRequest.of(0, 10000))
                .getContent();

        // Group by src_ip
        Map<String, List<NormalizedLog>> byIp = logs.stream()
                .filter(l -> l.getSrcIp() != null && !l.getSrcIp().isBlank())
                .collect(Collectors.groupingBy(NormalizedLog::getSrcIp));

        // Find IPs with multiple distinct event types (categories or source types)
        List<Map<String, Object>> correlations = new ArrayList<>();
        for (Map.Entry<String, List<NormalizedLog>> entry : byIp.entrySet()) {
            String ip = entry.getKey();
            List<NormalizedLog> ipLogs = entry.getValue();

            Set<String> distinctCategories = ipLogs.stream()
                    .map(NormalizedLog::getCategory)
                    .filter(Objects::nonNull)
                    .collect(Collectors.toSet());

            Set<String> distinctSeverities = ipLogs.stream()
                    .map(NormalizedLog::getSeverity)
                    .filter(Objects::nonNull)
                    .collect(Collectors.toSet());

            if (distinctCategories.size() > 1 || ipLogs.size() > 10) {
                Map<String, Object> correlation = new LinkedHashMap<>();
                correlation.put("srcIp", ip);
                correlation.put("eventCount", ipLogs.size());
                correlation.put("distinctCategories", new ArrayList<>(distinctCategories));
                correlation.put("distinctSeverities", new ArrayList<>(distinctSeverities));
                correlation.put("firstSeen", ipLogs.stream()
                        .map(NormalizedLog::getTimestamp)
                        .filter(Objects::nonNull)
                        .min(Comparator.naturalOrder())
                        .map(Object::toString).orElse(null));
                correlation.put("lastSeen", ipLogs.stream()
                        .map(NormalizedLog::getTimestamp)
                        .filter(Objects::nonNull)
                        .max(Comparator.naturalOrder())
                        .map(Object::toString).orElse(null));
                correlation.put("riskScore", Math.min(100, ipLogs.size() * 2 + distinctCategories.size() * 10));
                correlations.add(correlation);
            }
        }

        // Sort by risk score descending
        correlations.sort((a, b) -> Integer.compare(
                (Integer) b.get("riskScore"),
                (Integer) a.get("riskScore")
        ));

        return correlations;
    }

    public List<Map<String, Object>> getTopSources(String companyId, int limit) {
        log.debug("Getting top {} sources for company {}", limit, companyId);

        LocalDateTime since = LocalDateTime.now().minusHours(24);
        LocalDateTime now = LocalDateTime.now();

        List<NormalizedLog> logs = normalizedLogRepository
                .findByCompanyIdAndTimestampBetween(companyId, since, now, PageRequest.of(0, 50000))
                .getContent();

        // Count events per src_ip
        Map<String, Long> ipCounts = logs.stream()
                .filter(l -> l.getSrcIp() != null && !l.getSrcIp().isBlank())
                .collect(Collectors.groupingBy(NormalizedLog::getSrcIp, Collectors.counting()));

        return ipCounts.entrySet().stream()
                .sorted(Map.Entry.<String, Long>comparingByValue().reversed())
                .limit(limit > 0 ? limit : 10)
                .map(e -> {
                    Map<String, Object> entry = new LinkedHashMap<>();
                    entry.put("ip", e.getKey());
                    entry.put("count", e.getValue());
                    return entry;
                })
                .collect(Collectors.toList());
    }

    public Map<String, Long> getSeverityDistribution(String companyId) {
        log.debug("Getting severity distribution for company {}", companyId);

        LocalDateTime since = LocalDateTime.now().minusDays(7);
        LocalDateTime now = LocalDateTime.now();

        List<NormalizedLog> logs = normalizedLogRepository
                .findByCompanyIdAndTimestampBetween(companyId, since, now, PageRequest.of(0, 50000))
                .getContent();

        return logs.stream()
                .filter(l -> l.getSeverity() != null)
                .collect(Collectors.groupingBy(
                        l -> l.getSeverity().toLowerCase(),
                        Collectors.counting()
                ));
    }

    public List<Map<String, Object>> getTimeline(String companyId, LocalDateTime from, LocalDateTime to) {
        log.debug("Getting timeline for company {} from {} to {}", companyId, from, to);

        LocalDateTime startTime = (from != null) ? from : LocalDateTime.now().minusHours(24);
        LocalDateTime endTime = (to != null) ? to : LocalDateTime.now();

        List<NormalizedLog> logs = normalizedLogRepository
                .findByCompanyIdAndTimestampBetween(companyId, startTime, endTime, PageRequest.of(0, 100000))
                .getContent();

        // Group by hour
        DateTimeFormatter hourFormatter = DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:00");
        Map<String, Long> hourlyCounts = logs.stream()
                .filter(l -> l.getTimestamp() != null)
                .collect(Collectors.groupingBy(
                        l -> l.getTimestamp().format(hourFormatter),
                        Collectors.counting()
                ));

        // Build sorted timeline list
        return hourlyCounts.entrySet().stream()
                .sorted(Map.Entry.comparingByKey())
                .map(e -> {
                    Map<String, Object> entry = new LinkedHashMap<>();
                    entry.put("hour", e.getKey());
                    entry.put("count", e.getValue());
                    return entry;
                })
                .collect(Collectors.toList());
    }
}
