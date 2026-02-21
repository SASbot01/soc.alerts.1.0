package com.blackwolf.backend.service;

import com.blackwolf.backend.dto.MitreDTOs.*;
import com.blackwolf.backend.model.MitreTechnique;
import com.blackwolf.backend.model.ThreatEvent;
import com.blackwolf.backend.model.ThreatMitreMapping;
import com.blackwolf.backend.repository.MitreTechniqueRepository;
import com.blackwolf.backend.repository.ThreatEventRepository;
import com.blackwolf.backend.repository.ThreatMitreMappingRepository;
import com.blackwolf.backend.model.Incident;
import com.blackwolf.backend.repository.IncidentRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class MitreService {

    private static final Map<String, List<String>> THREAT_TYPE_TO_TECHNIQUES = new HashMap<>();

    static {
        THREAT_TYPE_TO_TECHNIQUES.put("BRUTE_FORCE", List.of("T1110"));
        THREAT_TYPE_TO_TECHNIQUES.put("DOS", List.of("T1498"));
        THREAT_TYPE_TO_TECHNIQUES.put("DDOS", List.of("T1498"));
        THREAT_TYPE_TO_TECHNIQUES.put("RANSOMWARE", List.of("T1486", "T1059"));
        THREAT_TYPE_TO_TECHNIQUES.put("MALWARE", List.of("T1059", "T1027"));
        THREAT_TYPE_TO_TECHNIQUES.put("PHISHING", List.of("T1078", "T1133"));
        THREAT_TYPE_TO_TECHNIQUES.put("PORT_SCAN", List.of("T1046", "T1595"));
        THREAT_TYPE_TO_TECHNIQUES.put("UNAUTHORIZED_ACCESS", List.of("T1078", "T1021"));
        THREAT_TYPE_TO_TECHNIQUES.put("SQL_INJECTION", List.of("T1190"));
        THREAT_TYPE_TO_TECHNIQUES.put("XSS", List.of("T1190"));
        THREAT_TYPE_TO_TECHNIQUES.put("EXPLOIT", List.of("T1190", "T1059"));
        THREAT_TYPE_TO_TECHNIQUES.put("C2", List.of("T1071", "T1133"));
        THREAT_TYPE_TO_TECHNIQUES.put("LATERAL_MOVEMENT", List.of("T1021", "T1078"));
        THREAT_TYPE_TO_TECHNIQUES.put("PRIVILEGE_ESCALATION", List.of("T1078", "T1053", "T1547"));
        THREAT_TYPE_TO_TECHNIQUES.put("DEFENSE_EVASION", List.of("T1562", "T1027"));
        THREAT_TYPE_TO_TECHNIQUES.put("RECONNAISSANCE", List.of("T1595", "T1046"));
        THREAT_TYPE_TO_TECHNIQUES.put("PERSISTENCE", List.of("T1053", "T1547", "T1133"));
    }

    @Autowired
    private MitreTechniqueRepository mitreTechniqueRepository;

    @Autowired
    private ThreatMitreMappingRepository threatMitreMappingRepository;

    @Autowired
    private ThreatEventRepository threatEventRepository;

    @Autowired
    private IncidentRepository incidentRepository;

    public List<MitreTechnique> listAll() {
        return mitreTechniqueRepository.findAll();
    }

    @Transactional
    public ThreatMitreMapping mapThreatToTechnique(String threatEventId, String techniqueId, Integer confidence) {
        threatEventRepository.findById(threatEventId)
                .orElseThrow(() -> new RuntimeException("Threat event not found"));

        mitreTechniqueRepository.findById(techniqueId)
                .orElseThrow(() -> new RuntimeException("MITRE technique not found"));

        ThreatMitreMapping mapping = new ThreatMitreMapping();
        mapping.setThreatEventId(threatEventId);
        mapping.setTechniqueId(techniqueId);
        mapping.setConfidence(confidence != null ? confidence : 50);
        mapping.setMappedAt(LocalDateTime.now());

        return threatMitreMappingRepository.save(mapping);
    }

    public List<MitreMappingResponse> getMappingsForThreat(String threatEventId) {
        List<ThreatMitreMapping> mappings = threatMitreMappingRepository.findByThreatEventId(threatEventId);
        return mappings.stream().map(m -> {
            MitreMappingResponse response = new MitreMappingResponse();
            response.setThreatEventId(m.getThreatEventId());
            response.setTechniqueId(m.getTechniqueId());
            response.setConfidence(m.getConfidence());
            response.setMappedAt(m.getMappedAt());

            mitreTechniqueRepository.findById(m.getTechniqueId()).ifPresent(t -> {
                response.setTechniqueName(t.getName());
                response.setTactic(t.getTactic());
            });

            return response;
        }).collect(Collectors.toList());
    }

    @Transactional
    public List<ThreatMitreMapping> autoMapThreat(String threatEventId, String companyId) {
        ThreatEvent event = threatEventRepository.findById(threatEventId)
                .orElseThrow(() -> new RuntimeException("Threat event not found"));
        if (!event.getCompanyId().equals(companyId)) {
            throw new RuntimeException("Access denied");
        }

        String threatType = event.getThreatType();
        if (threatType == null) {
            return Collections.emptyList();
        }

        String normalized = threatType.toUpperCase().replaceAll("[\\s-]+", "_");

        List<String> techniqueIds = THREAT_TYPE_TO_TECHNIQUES.get(normalized);
        if (techniqueIds == null || techniqueIds.isEmpty()) {
            return Collections.emptyList();
        }

        List<ThreatMitreMapping> results = new ArrayList<>();
        List<ThreatMitreMapping> existing = threatMitreMappingRepository.findByThreatEventId(threatEventId);
        Set<String> alreadyMapped = existing.stream()
                .map(ThreatMitreMapping::getTechniqueId)
                .collect(Collectors.toSet());

        for (String techniqueId : techniqueIds) {
            if (alreadyMapped.contains(techniqueId)) {
                continue;
            }
            if (mitreTechniqueRepository.findById(techniqueId).isPresent()) {
                ThreatMitreMapping mapping = new ThreatMitreMapping();
                mapping.setThreatEventId(threatEventId);
                mapping.setTechniqueId(techniqueId);
                mapping.setConfidence(70);
                mapping.setMappedAt(LocalDateTime.now());
                results.add(threatMitreMappingRepository.save(mapping));
            }
        }

        return results;
    }

    public List<MitreCoverageResponse> getCoverage(String companyId) {
        List<ThreatMitreMapping> mappings = threatMitreMappingRepository.findByCompanyId(companyId);

        // Group by techniqueId
        Map<String, List<ThreatMitreMapping>> byTechnique = mappings.stream()
                .collect(Collectors.groupingBy(ThreatMitreMapping::getTechniqueId));

        List<MitreCoverageResponse> result = new ArrayList<>();
        for (Map.Entry<String, List<ThreatMitreMapping>> entry : byTechnique.entrySet()) {
            String techId = entry.getKey();
            List<ThreatMitreMapping> techMappings = entry.getValue();

            MitreCoverageResponse cov = new MitreCoverageResponse();
            cov.setTechniqueId(techId);
            cov.setHitCount(techMappings.size());
            cov.setLastSeen(techMappings.stream()
                    .map(ThreatMitreMapping::getMappedAt)
                    .filter(Objects::nonNull)
                    .max(LocalDateTime::compareTo)
                    .orElse(null));

            mitreTechniqueRepository.findById(techId).ifPresent(t -> {
                cov.setTechniqueName(t.getName());
                cov.setTactic(t.getTactic());
            });

            result.add(cov);
        }
        return result;
    }

    public List<MitreMappingResponse> getMappingsForIncident(String incidentId) {
        Incident incident = incidentRepository.findById(incidentId)
                .orElseThrow(() -> new RuntimeException("Incident not found"));

        if (incident.getSourceThreatId() == null) {
            return Collections.emptyList();
        }

        return getMappingsForThreat(incident.getSourceThreatId());
    }
}
