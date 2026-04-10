package com.blackwolf.backend.service;

import com.blackwolf.backend.model.*;
import com.blackwolf.backend.repository.*;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.*;

@Service
@Slf4j
public class ForensicService {

    @Autowired
    private ForensicCaseRepository forensicCaseRepository;

    @Autowired
    private ForensicEvidenceRepository forensicEvidenceRepository;

    @Autowired
    private ForensicTimelineRepository forensicTimelineRepository;

    // --- Cases ---

    public List<ForensicCase> getCases(String companyId) {
        return forensicCaseRepository.findByCompanyIdOrderByCreatedAtDesc(companyId);
    }

    public ForensicCase createCase(String companyId, ForensicCase fcase) {
        fcase.setCompanyId(companyId);
        fcase.setStatus("open");
        fcase.setCreatedAt(LocalDateTime.now());
        ForensicCase saved = forensicCaseRepository.save(fcase);
        log.info("[DFIR] New forensic case created: id={} title='{}'", saved.getId(), saved.getTitle());
        return saved;
    }

    public ForensicCase updateCase(Long id, ForensicCase updates) {
        ForensicCase existing = forensicCaseRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("ForensicCase not found: " + id));
        if (updates.getTitle() != null) existing.setTitle(updates.getTitle());
        if (updates.getDescription() != null) existing.setDescription(updates.getDescription());
        if (updates.getSeverity() != null) existing.setSeverity(updates.getSeverity());
        if (updates.getLeadAnalyst() != null) existing.setLeadAnalyst(updates.getLeadAnalyst());
        if (updates.getStatus() != null) existing.setStatus(updates.getStatus());
        return forensicCaseRepository.save(existing);
    }

    public ForensicCase closeCase(Long id) {
        ForensicCase fcase = forensicCaseRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("ForensicCase not found: " + id));
        fcase.setStatus("closed");
        fcase.setClosedAt(LocalDateTime.now());
        log.info("[DFIR] Case {} closed", id);
        return forensicCaseRepository.save(fcase);
    }

    // --- Evidence ---

    public ForensicEvidence addEvidence(Long caseId, ForensicEvidence evidence) {
        evidence.setCaseId(caseId);
        evidence.setCollectedAt(LocalDateTime.now());
        return forensicEvidenceRepository.save(evidence);
    }

    public List<ForensicEvidence> getEvidence(Long caseId) {
        return forensicEvidenceRepository.findByCaseIdOrderByCollectedAtDesc(caseId);
    }

    // --- Timeline ---

    public ForensicTimeline addTimelineEvent(Long caseId, ForensicTimeline event) {
        event.setCaseId(caseId);
        return forensicTimelineRepository.save(event);
    }

    public List<ForensicTimeline> getTimeline(Long caseId) {
        return forensicTimelineRepository.findByCaseIdOrderByTimestampAsc(caseId);
    }

    // --- Stats ---

    public Map<String, Object> getStats(String companyId) {
        List<ForensicCase> openCases = forensicCaseRepository.findByCompanyIdAndStatus(companyId, "open");
        List<ForensicCase> allCases = forensicCaseRepository.findByCompanyIdOrderByCreatedAtDesc(companyId);

        long totalEvidence = allCases.stream()
                .mapToLong(c -> forensicEvidenceRepository.findByCaseIdOrderByCollectedAtDesc(c.getId()).size())
                .sum();

        LocalDateTime recentCutoff = LocalDateTime.now().minusDays(7);
        long recentCases = allCases.stream()
                .filter(c -> c.getCreatedAt() != null && c.getCreatedAt().isAfter(recentCutoff))
                .count();

        Map<String, Object> stats = new LinkedHashMap<>();
        stats.put("openCases", openCases.size());
        stats.put("totalEvidenceItems", totalEvidence);
        stats.put("recentCases", recentCases);
        return stats;
    }
}
