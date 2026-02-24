package com.blackwolf.backend.service.ai;

import com.blackwolf.backend.model.AiLearningEvent;
import com.blackwolf.backend.repository.AiLearningEventRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class FeedbackLoopService {

    private static final Logger log = LoggerFactory.getLogger(FeedbackLoopService.class);
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Autowired
    private AiLearningEventRepository learningEventRepository;

    /**
     * Analyze overrides to identify patterns the AI should learn from.
     * Returns recommendations for threshold adjustments.
     */
    public Map<String, Object> analyzeOverrides(String companyId, int days) {
        LocalDateTime since = LocalDateTime.now().minusDays(days);
        List<AiLearningEvent> overrides = learningEventRepository
                .findByEventTypeAndLearnedAtAfter("override", since)
                .stream()
                .filter(e -> companyId == null || companyId.equals(e.getCompanyId()))
                .collect(Collectors.toList());

        // Group overrides by threat type
        Map<String, Long> overridesByType = overrides.stream()
                .filter(e -> e.getThreatType() != null)
                .collect(Collectors.groupingBy(AiLearningEvent::getThreatType, Collectors.counting()));

        // Identify most overridden verdicts
        Map<String, Long> overridesByVerdict = overrides.stream()
                .filter(e -> e.getOriginalVerdict() != null)
                .collect(Collectors.groupingBy(AiLearningEvent::getOriginalVerdict, Collectors.counting()));

        // Generate recommendations
        List<String> recommendations = new ArrayList<>();
        overridesByType.forEach((type, count) -> {
            if (count >= 5) {
                recommendations.add("High override rate for '" + type + "' threats (" + count +
                        " overrides). Consider adjusting detection threshold.");
            }
        });

        Map<String, Object> analysis = new LinkedHashMap<>();
        analysis.put("period", days + " days");
        analysis.put("totalOverrides", overrides.size());
        analysis.put("byThreatType", overridesByType);
        analysis.put("byVerdict", overridesByVerdict);
        analysis.put("recommendations", recommendations);
        return analysis;
    }

    /**
     * Check if a specific threat type has high false positive rate,
     * suggesting the AI should be less aggressive.
     */
    public boolean isHighFalsePositiveType(String companyId, String threatType) {
        List<AiLearningEvent> events = learningEventRepository.findByCompanyIdAndEventType(companyId, "override");
        long overridesForType = events.stream()
                .filter(e -> threatType.equals(e.getThreatType()))
                .count();

        List<AiLearningEvent> decisions = learningEventRepository.findByCompanyIdAndEventType(companyId, "decision");
        long decisionsForType = decisions.stream()
                .filter(e -> threatType.equals(e.getThreatType()))
                .count();

        if (decisionsForType < 5) return false;
        return (double) overridesForType / decisionsForType > 0.3;
    }
}
