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
import java.util.stream.Collectors;

@Service
@Slf4j
public class LogIngestionService {

    @Autowired
    private NormalizedLogRepository normalizedLogRepository;

    @Autowired
    private LogSourceRepository logSourceRepository;

    public NormalizedLog ingestLog(String companyId, Map<String, Object> logData) {
        log.debug("Ingesting log for company {}: {}", companyId, logData);

        NormalizedLog normalizedLog = new NormalizedLog();
        normalizedLog.setCompanyId(companyId);
        normalizedLog.setTimestamp(LocalDateTime.now());
        normalizedLog.setIndexedAt(LocalDateTime.now());

        // Parse common fields
        if (logData.containsKey("src_ip")) {
            normalizedLog.setSrcIp(String.valueOf(logData.get("src_ip")));
        }
        if (logData.containsKey("dst_ip")) {
            normalizedLog.setDstIp(String.valueOf(logData.get("dst_ip")));
        }
        if (logData.containsKey("src_port")) {
            try {
                normalizedLog.setSrcPort(Integer.parseInt(String.valueOf(logData.get("src_port"))));
            } catch (NumberFormatException e) {
                log.warn("Invalid src_port value: {}", logData.get("src_port"));
            }
        }
        if (logData.containsKey("dst_port")) {
            try {
                normalizedLog.setDstPort(Integer.parseInt(String.valueOf(logData.get("dst_port"))));
            } catch (NumberFormatException e) {
                log.warn("Invalid dst_port value: {}", logData.get("dst_port"));
            }
        }
        if (logData.containsKey("severity")) {
            normalizedLog.setSeverity(String.valueOf(logData.get("severity")));
        }
        if (logData.containsKey("category")) {
            normalizedLog.setCategory(String.valueOf(logData.get("category")));
        }
        if (logData.containsKey("source_type")) {
            normalizedLog.setSourceType(String.valueOf(logData.get("source_type")));
        }
        if (logData.containsKey("source_name")) {
            normalizedLog.setSourceName(String.valueOf(logData.get("source_name")));
        }
        if (logData.containsKey("username")) {
            normalizedLog.setUsername(String.valueOf(logData.get("username")));
        }
        if (logData.containsKey("hostname")) {
            normalizedLog.setHostname(String.valueOf(logData.get("hostname")));
        }
        if (logData.containsKey("action")) {
            normalizedLog.setAction(String.valueOf(logData.get("action")));
        }
        if (logData.containsKey("outcome")) {
            normalizedLog.setOutcome(String.valueOf(logData.get("outcome")));
        }
        if (logData.containsKey("raw")) {
            normalizedLog.setRawData(String.valueOf(logData.get("raw")));
        }

        // Store full payload as parsedData JSON string
        normalizedLog.setParsedData(logData.toString());

        NormalizedLog saved = normalizedLogRepository.save(normalizedLog);
        log.info("Log ingested for company {} with id {}", companyId, saved.getId());
        return saved;
    }

    public Page<NormalizedLog> searchLogs(String companyId, String query, LocalDateTime from, LocalDateTime to, Pageable pageable) {
        log.debug("Searching logs for company {} from {} to {}, query: {}", companyId, from, to, query);

        LocalDateTime startTime = (from != null) ? from : LocalDateTime.now().minusDays(7);
        LocalDateTime endTime = (to != null) ? to : LocalDateTime.now();

        return normalizedLogRepository.findByCompanyIdAndTimestampBetween(companyId, startTime, endTime, pageable);
    }

    public List<LogSource> getLogSources(String companyId) {
        log.debug("Fetching log sources for company {}", companyId);
        return logSourceRepository.findByCompanyIdOrderByLastEventAtDesc(companyId);
    }

    public LogSource addLogSource(String companyId, LogSource source) {
        log.info("Adding log source for company {}: {}", companyId, source.getName());
        source.setCompanyId(companyId);
        source.setCreatedAt(LocalDateTime.now());
        if (source.getEnabled() == null) {
            source.setEnabled(true);
        }
        return logSourceRepository.save(source);
    }

    public Map<String, Object> getStats(String companyId) {
        log.debug("Getting log stats for company {}", companyId);

        LocalDateTime startOfDay = LocalDateTime.now().withHour(0).withMinute(0).withSecond(0).withNano(0);
        long logsToday = normalizedLogRepository.countByCompanyIdAndTimestampAfter(companyId, startOfDay);

        List<LogSource> sources = logSourceRepository.findByCompanyIdOrderByLastEventAtDesc(companyId);
        long activeSources = sources.stream().filter(s -> Boolean.TRUE.equals(s.getEnabled())).count();

        // Count source types
        Map<String, Long> sourceTypeCounts = sources.stream()
                .filter(s -> s.getSourceType() != null)
                .collect(Collectors.groupingBy(LogSource::getSourceType, Collectors.counting()));

        // Build top source types list sorted by count descending
        List<Map<String, Object>> topSourceTypes = sourceTypeCounts.entrySet().stream()
                .sorted(Map.Entry.<String, Long>comparingByValue().reversed())
                .limit(5)
                .map(e -> {
                    Map<String, Object> entry = new LinkedHashMap<>();
                    entry.put("type", e.getKey());
                    entry.put("count", e.getValue());
                    return entry;
                })
                .collect(Collectors.toList());

        Map<String, Object> stats = new LinkedHashMap<>();
        stats.put("logsToday", logsToday);
        stats.put("activeSources", activeSources);
        stats.put("totalSources", (long) sources.size());
        stats.put("topSourceTypes", topSourceTypes);
        return stats;
    }
}
