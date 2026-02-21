package com.blackwolf.backend.service;

import com.blackwolf.backend.dto.ThreatDTOs.*;
import com.blackwolf.backend.model.ThreatEvent;
import com.blackwolf.backend.repository.ThreatEnrichmentRepository;
import com.blackwolf.backend.repository.ThreatEventRepository;
import com.blackwolf.backend.specification.ThreatSpecifications;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

@Service
public class ThreatService {

    @Autowired
    private ThreatEventRepository threatEventRepository;

    @Autowired
    private ThreatEnrichmentRepository enrichmentRepository;

    public ThreatListResponse getThreats(String companyId, ThreatFilterRequest filter) {
        Specification<ThreatEvent> spec = ThreatSpecifications.hasCompanyId(companyId);

        if (filter.getThreatType() != null && !filter.getThreatType().isEmpty()) {
            spec = spec.and(ThreatSpecifications.hasThreatType(filter.getThreatType()));
        }
        if (filter.getStatus() != null && !filter.getStatus().isEmpty()) {
            spec = spec.and(ThreatSpecifications.hasStatus(filter.getStatus()));
        }
        if (filter.getMinSeverity() != null) {
            spec = spec.and(ThreatSpecifications.hasSeverityGreaterThanOrEqual(filter.getMinSeverity()));
        }
        if (filter.getMaxSeverity() != null) {
            spec = spec.and(ThreatSpecifications.hasSeverityLessThanOrEqual(filter.getMaxSeverity()));
        }
        if (filter.getFrom() != null) {
            spec = spec.and(ThreatSpecifications.timestampAfter(filter.getFrom()));
        }
        if (filter.getTo() != null) {
            spec = spec.and(ThreatSpecifications.timestampBefore(filter.getTo()));
        }
        if (filter.getSearch() != null && !filter.getSearch().isEmpty()) {
            spec = spec.and(ThreatSpecifications.searchByIp(filter.getSearch()));
        }

        Sort sort = filter.getSortDir().equalsIgnoreCase("asc")
                ? Sort.by(filter.getSortBy()).ascending()
                : Sort.by(filter.getSortBy()).descending();

        Page<ThreatEvent> page = threatEventRepository.findAll(spec,
                PageRequest.of(filter.getPage(), filter.getSize(), sort));

        ThreatListResponse response = new ThreatListResponse();
        response.setContent(page.getContent().stream().map(this::toSummary).collect(Collectors.toList()));
        response.setPage(page.getNumber());
        response.setSize(page.getSize());
        response.setTotalElements(page.getTotalElements());
        response.setTotalPages(page.getTotalPages());
        return response;
    }

    public ThreatEvent updateStatus(String threatId, String companyId, String newStatus) {
        ThreatEvent event = threatEventRepository.findById(threatId)
                .orElseThrow(() -> new RuntimeException("Threat event not found"));
        if (!event.getCompanyId().equals(companyId)) {
            throw new RuntimeException("Access denied");
        }
        event.setStatus(newStatus);
        return threatEventRepository.save(event);
    }

    public List<Map<String, Object>> getMapOrigins(String companyId) {
        List<Object[]> origins = threatEventRepository.findMapOriginsByCompanyId(companyId);
        List<Map<String, Object>> result = new ArrayList<>();

        for (Object[] row : origins) {
            String ip = (String) row[0];
            Long count = (Long) row[1];
            Integer maxSeverity = (Integer) row[2];
            String threatType = (String) row[3];

            Map<String, Object> entry = new LinkedHashMap<>();
            entry.put("srcIp", ip);
            entry.put("count", count);
            entry.put("maxSeverity", maxSeverity);
            entry.put("threatType", threatType);

            enrichmentRepository.findById(ip).ifPresent(e -> {
                entry.put("countryCode", e.getCountryCode());
                entry.put("isp", e.getIsp());
                entry.put("abuseScore", e.getAbuseConfidenceScore());
                entry.put("isTor", e.isTor());
                entry.put("isVpn", e.isVpn());
                entry.put("totalReports", e.getTotalReports());
            });

            result.add(entry);
        }
        return result;
    }

    private ThreatSummary toSummary(ThreatEvent e) {
        ThreatSummary s = new ThreatSummary();
        s.setId(e.getId());
        s.setThreatType(e.getThreatType());
        s.setSeverity(e.getSeverity());
        s.setSrcIp(e.getSrcIp());
        s.setDstIp(e.getDstIp());
        s.setDstPort(e.getDstPort());
        s.setTimestamp(e.getTimestamp());
        s.setStatus(e.getStatus());
        s.setDescription(e.getDescription());
        s.setSensorId(e.getSensorId());
        return s;
    }
}
