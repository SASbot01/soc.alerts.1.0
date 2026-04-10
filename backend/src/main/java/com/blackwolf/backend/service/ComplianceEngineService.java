package com.blackwolf.backend.service;

import com.blackwolf.backend.model.*;
import com.blackwolf.backend.repository.*;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.*;

@Service
@Slf4j
public class ComplianceEngineService {

    @Autowired
    private ComplianceFrameworkRepository frameworkRepository;

    @Autowired
    private ComplianceControlRepository controlRepository;

    @Autowired
    private ComplianceAssessmentRepository assessmentRepository;

    @Autowired
    private ComplianceResultRepository resultRepository;

    // --- Frameworks ---

    public List<ComplianceFramework> getFrameworks(String companyId) {
        return frameworkRepository.findByCompanyIdOrderByNameAsc(companyId);
    }

    public ComplianceFramework createFramework(String companyId, ComplianceFramework fw) {
        fw.setCompanyId(companyId);
        fw.setCreatedAt(LocalDateTime.now());
        if (fw.getTotalControls() == null) fw.setTotalControls(0);
        if (fw.getEnabled() == null) fw.setEnabled(true);
        return frameworkRepository.save(fw);
    }

    // --- Controls ---

    public List<ComplianceControl> getControls(Long frameworkId) {
        return controlRepository.findByFrameworkIdOrderByControlIdAsc(frameworkId);
    }

    public ComplianceControl addControl(Long frameworkId, ComplianceControl control) {
        control.setFrameworkId(frameworkId);
        ComplianceControl saved = controlRepository.save(control);

        frameworkRepository.findById(frameworkId).ifPresent(fw -> {
            int current = fw.getTotalControls() == null ? 0 : fw.getTotalControls();
            fw.setTotalControls(current + 1);
            frameworkRepository.save(fw);
        });

        return saved;
    }

    // --- Assessments ---

    public ComplianceAssessment startAssessment(String companyId, Long frameworkId) {
        ComplianceAssessment assessment = new ComplianceAssessment();
        assessment.setCompanyId(companyId);
        assessment.setFrameworkId(frameworkId);
        assessment.setStatus("in_progress");
        assessment.setStartedAt(LocalDateTime.now());
        return assessmentRepository.save(assessment);
    }

    public ComplianceResult submitResult(Long assessmentId, ComplianceResult result) {
        result.setAssessmentId(assessmentId);
        result.setCheckedAt(LocalDateTime.now());
        return resultRepository.save(result);
    }

    public ComplianceAssessment completeAssessment(Long assessmentId) {
        ComplianceAssessment assessment = assessmentRepository.findById(assessmentId)
                .orElseThrow(() -> new RuntimeException("Assessment not found: " + assessmentId));

        long passed = resultRepository.countByAssessmentIdAndStatus(assessmentId, "passed");
        long failed = resultRepository.countByAssessmentIdAndStatus(assessmentId, "failed");
        long na     = resultRepository.countByAssessmentIdAndStatus(assessmentId, "na");

        assessment.setPassed((int) passed);
        assessment.setFailed((int) failed);
        assessment.setNaCount((int) na);

        double total = passed + failed;
        BigDecimal score = total > 0
                ? BigDecimal.valueOf((passed / total) * 100.0).setScale(2, java.math.RoundingMode.HALF_UP)
                : BigDecimal.ZERO;
        assessment.setOverallScore(score);
        assessment.setStatus("completed");
        assessment.setCompletedAt(LocalDateTime.now());

        log.info("[Compliance] Assessment {} completed — score={} passed={} failed={} na={}",
                assessmentId, score, passed, failed, na);
        return assessmentRepository.save(assessment);
    }

    public List<ComplianceAssessment> getAssessments(String companyId) {
        return assessmentRepository.findByCompanyIdOrderByStartedAtDesc(companyId);
    }

    public List<ComplianceResult> getAssessmentResults(Long assessmentId) {
        return resultRepository.findByAssessmentId(assessmentId);
    }

    // --- Stats ---

    public Map<String, Object> getStats(String companyId) {
        long frameworks = frameworkRepository.findByCompanyIdOrderByNameAsc(companyId).size();
        List<ComplianceAssessment> assessments = assessmentRepository.findByCompanyIdOrderByStartedAtDesc(companyId);

        BigDecimal latestScore = assessments.stream()
                .filter(a -> a.getOverallScore() != null)
                .findFirst()
                .map(ComplianceAssessment::getOverallScore)
                .orElse(BigDecimal.ZERO);

        long controls = frameworkRepository.findByCompanyIdOrderByNameAsc(companyId).stream()
                .mapToLong(fw -> controlRepository.countByFrameworkId(fw.getId()))
                .sum();

        Map<String, Object> stats = new LinkedHashMap<>();
        stats.put("frameworks", frameworks);
        stats.put("latestAssessmentScore", latestScore);
        stats.put("controls", controls);
        return stats;
    }
}
