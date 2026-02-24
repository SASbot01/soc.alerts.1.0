package com.blackwolf.backend.service;

import com.blackwolf.backend.model.BehaviorAnomaly;
import com.blackwolf.backend.model.EntityBehaviorProfile;
import com.blackwolf.backend.model.ThreatEvent;
import com.blackwolf.backend.repository.BehaviorAnomalyRepository;
import com.blackwolf.backend.repository.EntityBehaviorProfileRepository;
import com.blackwolf.backend.repository.ThreatEventRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class UebaService {

    private static final Logger log = LoggerFactory.getLogger(UebaService.class);
    private static final double ANOMALY_THRESHOLD = 70.0;

    @Autowired
    private EntityBehaviorProfileRepository profileRepository;

    @Autowired
    private BehaviorAnomalyRepository anomalyRepository;

    @Autowired
    private ThreatEventRepository threatEventRepository;

    @Autowired
    private ObjectMapper objectMapper;

    // ---------------------------------------------------------------
    // Real-time evaluation — called when a new ThreatEvent arrives
    // ---------------------------------------------------------------

    @Transactional
    public void evaluateEvent(ThreatEvent event) {
        if (event.getSrcIp() == null || event.getCompanyId() == null) {
            return;
        }

        String companyId = event.getCompanyId();
        String entityType = "ip";
        String entityId = event.getSrcIp();

        // Find or create the behavior profile for this source IP
        EntityBehaviorProfile profile = profileRepository
                .findByCompanyIdAndEntityTypeAndEntityId(companyId, entityType, entityId)
                .orElseGet(() -> {
                    EntityBehaviorProfile p = new EntityBehaviorProfile();
                    p.setCompanyId(companyId);
                    p.setEntityType(entityType);
                    p.setEntityId(entityId);
                    p.setRiskScore(0.0);
                    p.setTotalEvents(0L);
                    p.setAnomalyCount(0);
                    return p;
                });

        // Update counters
        profile.setTotalEvents(profile.getTotalEvents() + 1);
        profile.setLastActivityAt(LocalDateTime.now());

        // Calculate anomaly score based on behavioral deviations
        double anomalyScore = calculateAnomalyScore(profile, event);

        if (anomalyScore > ANOMALY_THRESHOLD) {
            // Create anomaly record
            BehaviorAnomaly anomaly = new BehaviorAnomaly();
            anomaly.setCompanyId(companyId);
            anomaly.setProfileId(profile.getId() != null ? profile.getId() : "pending");
            anomaly.setAnomalyType(determineAnomalyType(profile, event));
            anomaly.setAnomalyScore(anomalyScore);
            anomaly.setDescription(buildAnomalyDescription(profile, event, anomalyScore));

            try {
                Map<String, Object> eventDataMap = new LinkedHashMap<>();
                eventDataMap.put("threatEventId", event.getId());
                eventDataMap.put("srcIp", event.getSrcIp());
                eventDataMap.put("dstIp", event.getDstIp());
                eventDataMap.put("dstPort", event.getDstPort());
                eventDataMap.put("threatType", event.getThreatType());
                eventDataMap.put("severity", event.getSeverity());
                eventDataMap.put("timestamp", event.getTimestamp() != null ? event.getTimestamp().toString() : null);
                anomaly.setEventData(objectMapper.writeValueAsString(eventDataMap));
            } catch (Exception e) {
                log.warn("Failed to serialize event data for anomaly: {}", e.getMessage());
                anomaly.setEventData("{}");
            }

            // Update profile risk score (weighted average with new anomaly)
            double newRisk = Math.min(100.0, (profile.getRiskScore() * 0.7) + (anomalyScore * 0.3));
            profile.setRiskScore(newRisk);
            profile.setAnomalyCount(profile.getAnomalyCount() + 1);

            // Save profile first so we get the generated ID
            profile = profileRepository.save(profile);

            // Now set the correct profile ID on the anomaly
            anomaly.setProfileId(profile.getId());
            anomalyRepository.save(anomaly);

            log.info("UEBA anomaly detected for entity {}/{} in company {}: score={}, type={}",
                    entityType, entityId, companyId, anomalyScore, anomaly.getAnomalyType());
        } else {
            // Gradually decay risk score when behavior is normal
            if (profile.getRiskScore() > 0) {
                profile.setRiskScore(Math.max(0.0, profile.getRiskScore() * 0.98));
            }
            profileRepository.save(profile);
        }
    }

    // ---------------------------------------------------------------
    // Anomaly score calculation
    // ---------------------------------------------------------------

    private double calculateAnomalyScore(EntityBehaviorProfile profile, ThreatEvent event) {
        double score = 0.0;

        // Factor 1: Time-of-day deviation
        score += calculateTimeOfDayDeviation(profile, event);

        // Factor 2: Volume spike detection
        score += calculateVolumeSpike(profile);

        // Factor 3: New destination IP detection
        score += calculateNewDestinationScore(profile, event);

        return Math.min(100.0, score);
    }

    /**
     * Check if the event occurs at an unusual hour compared to the baseline.
     * Business hours (08-18) are considered normal. Events at 2-5 AM score high.
     */
    private double calculateTimeOfDayDeviation(EntityBehaviorProfile profile, ThreatEvent event) {
        LocalDateTime eventTime = event.getTimestamp() != null ? event.getTimestamp() : LocalDateTime.now();
        int hour = eventTime.getHour();

        // Parse baseline to check typical activity hours
        Map<String, Object> baseline = parseBaseline(profile.getBaselineData());
        if (baseline != null && baseline.containsKey("typicalHours")) {
            try {
                @SuppressWarnings("unchecked")
                List<Integer> typicalHours = (List<Integer>) baseline.get("typicalHours");
                if (!typicalHours.isEmpty() && !typicalHours.contains(hour)) {
                    // Activity outside typical hours — more unusual = higher score
                    return 35.0;
                }
                return 0.0;
            } catch (Exception e) {
                // Fall through to default heuristic
            }
        }

        // Default heuristic: late-night activity (0-5 AM) is suspicious
        if (hour >= 0 && hour <= 5) {
            return 30.0;
        }
        return 0.0;
    }

    /**
     * Detect volume spikes: if totalEvents is significantly above the baseline average.
     */
    private double calculateVolumeSpike(EntityBehaviorProfile profile) {
        Map<String, Object> baseline = parseBaseline(profile.getBaselineData());
        if (baseline != null && baseline.containsKey("avgEventsPerHour")) {
            try {
                double avgPerHour = ((Number) baseline.get("avgEventsPerHour")).doubleValue();
                if (avgPerHour > 0 && profile.getTotalEvents() != null) {
                    // Estimate current rate: use total events divided by profile age in hours
                    LocalDateTime created = profile.getCreatedAt() != null ? profile.getCreatedAt() : LocalDateTime.now().minusHours(1);
                    long hoursActive = Math.max(1, ChronoUnit.HOURS.between(created, LocalDateTime.now()));
                    double currentRate = (double) profile.getTotalEvents() / hoursActive;

                    if (currentRate > avgPerHour * 3) {
                        return 40.0; // 3x spike
                    } else if (currentRate > avgPerHour * 2) {
                        return 25.0; // 2x spike
                    }
                }
            } catch (Exception e) {
                // Fall through
            }
        }

        // Without baseline, flag high-volume entities
        if (profile.getTotalEvents() != null && profile.getTotalEvents() > 100) {
            return 15.0;
        }
        return 0.0;
    }

    /**
     * Check if the destination IP in this event is new for this entity.
     * New destination IPs indicate lateral movement or reconnaissance.
     */
    private double calculateNewDestinationScore(EntityBehaviorProfile profile, ThreatEvent event) {
        if (event.getDstIp() == null) {
            return 0.0;
        }

        Map<String, Object> baseline = parseBaseline(profile.getBaselineData());
        if (baseline != null && baseline.containsKey("knownDestIps")) {
            try {
                @SuppressWarnings("unchecked")
                List<String> knownIps = (List<String>) baseline.get("knownDestIps");
                if (!knownIps.isEmpty() && !knownIps.contains(event.getDstIp())) {
                    return 30.0; // New destination not in baseline
                }
                return 0.0;
            } catch (Exception e) {
                // Fall through
            }
        }

        // No baseline yet — low score, first events are building the profile
        return 5.0;
    }

    private String determineAnomalyType(EntityBehaviorProfile profile, ThreatEvent event) {
        LocalDateTime eventTime = event.getTimestamp() != null ? event.getTimestamp() : LocalDateTime.now();
        int hour = eventTime.getHour();

        if (hour >= 0 && hour <= 5) {
            return "TIME_DEVIATION";
        }

        Map<String, Object> baseline = parseBaseline(profile.getBaselineData());
        if (baseline != null && baseline.containsKey("avgEventsPerHour")) {
            try {
                double avgPerHour = ((Number) baseline.get("avgEventsPerHour")).doubleValue();
                LocalDateTime created = profile.getCreatedAt() != null ? profile.getCreatedAt() : LocalDateTime.now().minusHours(1);
                long hoursActive = Math.max(1, ChronoUnit.HOURS.between(created, LocalDateTime.now()));
                double currentRate = (double) profile.getTotalEvents() / hoursActive;
                if (currentRate > avgPerHour * 2) {
                    return "VOLUME_SPIKE";
                }
            } catch (Exception e) {
                // Fall through
            }
        }

        if (event.getDstIp() != null) {
            if (baseline != null && baseline.containsKey("knownDestIps")) {
                try {
                    @SuppressWarnings("unchecked")
                    List<String> knownIps = (List<String>) baseline.get("knownDestIps");
                    if (!knownIps.contains(event.getDstIp())) {
                        return "NEW_DESTINATION";
                    }
                } catch (Exception e) {
                    // Fall through
                }
            }
        }

        return "BEHAVIORAL_DEVIATION";
    }

    private String buildAnomalyDescription(EntityBehaviorProfile profile, ThreatEvent event, double score) {
        return String.format(
                "Behavioral anomaly detected for %s/%s — score: %.1f, threat type: %s, " +
                "src: %s -> dst: %s:%s, total events: %d",
                profile.getEntityType(),
                profile.getEntityId(),
                score,
                event.getThreatType(),
                event.getSrcIp(),
                event.getDstIp() != null ? event.getDstIp() : "N/A",
                event.getDstPort() != null ? event.getDstPort().toString() : "N/A",
                profile.getTotalEvents()
        );
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> parseBaseline(String baselineJson) {
        if (baselineJson == null || baselineJson.isBlank()) {
            return null;
        }
        try {
            return objectMapper.readValue(baselineJson, new TypeReference<Map<String, Object>>() {});
        } catch (Exception e) {
            log.warn("Failed to parse baseline JSON: {}", e.getMessage());
            return null;
        }
    }

    // ---------------------------------------------------------------
    // Scheduled baseline recalculation — runs daily at 3:00 AM
    // ---------------------------------------------------------------

    @Scheduled(cron = "0 0 3 * * *")
    @Transactional
    public void updateBehaviorProfiles() {
        log.info("UEBA: Starting daily behavior profile baseline update");

        List<EntityBehaviorProfile> allProfiles = profileRepository.findAll();
        int updated = 0;

        for (EntityBehaviorProfile profile : allProfiles) {
            try {
                updateSingleProfileBaseline(profile);
                updated++;
            } catch (Exception e) {
                log.warn("UEBA: Failed to update baseline for profile {}: {}", profile.getId(), e.getMessage());
            }
        }

        log.info("UEBA: Completed baseline update for {} profiles", updated);
    }

    private void updateSingleProfileBaseline(EntityBehaviorProfile profile) {
        String companyId = profile.getCompanyId();
        LocalDateTime since = LocalDateTime.now().minusDays(30);

        // Fetch recent threat events for this entity
        List<ThreatEvent> recentEvents = threatEventRepository
                .findByCompanyIdAndTimestampAfterOrderByTimestampDesc(companyId, since)
                .stream()
                .filter(e -> profile.getEntityId().equals(e.getSrcIp()))
                .collect(Collectors.toList());

        if (recentEvents.isEmpty()) {
            return;
        }

        // Compute avg events per hour, grouped by day of week
        Map<Integer, List<ThreatEvent>> byDayOfWeek = recentEvents.stream()
                .filter(e -> e.getTimestamp() != null)
                .collect(Collectors.groupingBy(e -> e.getTimestamp().getDayOfWeek().getValue()));

        Map<String, Double> avgEventsPerHourByDay = new LinkedHashMap<>();
        double totalAvg = 0.0;
        int dayCount = 0;

        for (Map.Entry<Integer, List<ThreatEvent>> entry : byDayOfWeek.entrySet()) {
            int dayOfWeek = entry.getKey();
            List<ThreatEvent> dayEvents = entry.getValue();

            // Count distinct hours with activity, then compute average
            Map<Integer, Long> hourCounts = dayEvents.stream()
                    .filter(e -> e.getTimestamp() != null)
                    .collect(Collectors.groupingBy(
                            e -> e.getTimestamp().getHour(),
                            Collectors.counting()));

            double avgForDay = hourCounts.values().stream()
                    .mapToLong(Long::longValue)
                    .average()
                    .orElse(0.0);

            avgEventsPerHourByDay.put("day_" + dayOfWeek, avgForDay);
            totalAvg += avgForDay;
            dayCount++;
        }

        double overallAvgPerHour = dayCount > 0 ? totalAvg / dayCount : 0.0;

        // Determine typical active hours
        Set<Integer> typicalHours = recentEvents.stream()
                .filter(e -> e.getTimestamp() != null)
                .map(e -> e.getTimestamp().getHour())
                .collect(Collectors.toSet());

        // Collect known destination IPs
        Set<String> knownDestIps = recentEvents.stream()
                .map(ThreatEvent::getDstIp)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());

        // Build baseline JSON
        Map<String, Object> baseline = new LinkedHashMap<>();
        baseline.put("avgEventsPerHour", Math.round(overallAvgPerHour * 100.0) / 100.0);
        baseline.put("avgEventsPerHourByDay", avgEventsPerHourByDay);
        baseline.put("typicalHours", new ArrayList<>(typicalHours));
        baseline.put("knownDestIps", new ArrayList<>(knownDestIps));
        baseline.put("totalEventsInWindow", recentEvents.size());
        baseline.put("computedAt", LocalDateTime.now().toString());

        try {
            profile.setBaselineData(objectMapper.writeValueAsString(baseline));
        } catch (Exception e) {
            log.warn("Failed to serialize baseline for profile {}: {}", profile.getId(), e.getMessage());
        }

        profile.setProfileUpdatedAt(LocalDateTime.now());
        profileRepository.save(profile);
    }

    // ---------------------------------------------------------------
    // Query methods for controller
    // ---------------------------------------------------------------

    public List<EntityBehaviorProfile> getProfiles(String companyId) {
        return profileRepository.findByCompanyIdOrderByRiskScoreDesc(companyId);
    }

    public List<BehaviorAnomaly> getAnomalies(String companyId) {
        return anomalyRepository.findByCompanyIdOrderByDetectedAtDesc(companyId);
    }

    @Transactional
    public BehaviorAnomaly reviewAnomaly(String anomalyId, String companyId, String reviewedBy) {
        BehaviorAnomaly anomaly = anomalyRepository.findById(anomalyId)
                .orElseThrow(() -> new RuntimeException("Anomaly not found"));
        if (!anomaly.getCompanyId().equals(companyId)) {
            throw new RuntimeException("Access denied");
        }
        anomaly.setIsReviewed(true);
        anomaly.setReviewedBy(reviewedBy);
        return anomalyRepository.save(anomaly);
    }

    public Map<String, Object> getDashboardStats(String companyId) {
        List<EntityBehaviorProfile> profiles = profileRepository.findByCompanyIdOrderByRiskScoreDesc(companyId);
        long totalProfiles = profiles.size();
        long highRiskCount = profiles.stream()
                .filter(p -> p.getRiskScore() != null && p.getRiskScore() >= 70.0)
                .count();
        long unreviewedAnomalies = anomalyRepository.countByCompanyIdAndIsReviewedFalse(companyId);
        List<BehaviorAnomaly> recentAnomalies = anomalyRepository.findByCompanyIdOrderByDetectedAtDesc(companyId)
                .stream()
                .limit(10)
                .collect(Collectors.toList());

        Map<String, Object> stats = new LinkedHashMap<>();
        stats.put("totalProfiles", totalProfiles);
        stats.put("highRiskCount", highRiskCount);
        stats.put("unreviewedAnomalies", unreviewedAnomalies);
        stats.put("recentAnomalies", recentAnomalies);
        return stats;
    }
}
