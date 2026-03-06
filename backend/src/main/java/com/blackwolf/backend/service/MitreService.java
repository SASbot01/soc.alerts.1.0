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
        // Credential Access
        THREAT_TYPE_TO_TECHNIQUES.put("BRUTE_FORCE", List.of("T1110", "T1110.001", "T1110.003", "T1110.004"));
        THREAT_TYPE_TO_TECHNIQUES.put("CREDENTIAL_STUFFING", List.of("T1110.004", "T1078"));
        THREAT_TYPE_TO_TECHNIQUES.put("PASSWORD_SPRAY", List.of("T1110.003", "T1078"));
        THREAT_TYPE_TO_TECHNIQUES.put("CREDENTIAL_THEFT", List.of("T1003", "T1555", "T1552"));
        THREAT_TYPE_TO_TECHNIQUES.put("KERBEROASTING", List.of("T1558.003", "T1558"));
        THREAT_TYPE_TO_TECHNIQUES.put("CREDENTIAL_DUMPING", List.of("T1003", "T1003.001", "T1003.002", "T1003.003"));

        // Impact / DoS
        THREAT_TYPE_TO_TECHNIQUES.put("DOS", List.of("T1498", "T1498.001", "T1499"));
        THREAT_TYPE_TO_TECHNIQUES.put("DDOS", List.of("T1498", "T1498.001", "T1498.002", "T1499"));
        THREAT_TYPE_TO_TECHNIQUES.put("RANSOMWARE", List.of("T1486", "T1059", "T1490", "T1489"));
        THREAT_TYPE_TO_TECHNIQUES.put("WIPER", List.of("T1485", "T1561", "T1561.001", "T1561.002"));
        THREAT_TYPE_TO_TECHNIQUES.put("DEFACEMENT", List.of("T1491", "T1491.001", "T1491.002"));
        THREAT_TYPE_TO_TECHNIQUES.put("RESOURCE_HIJACKING", List.of("T1496"));
        THREAT_TYPE_TO_TECHNIQUES.put("CRYPTOMINING", List.of("T1496"));

        // Execution / Malware
        THREAT_TYPE_TO_TECHNIQUES.put("MALWARE", List.of("T1059", "T1027", "T1204.002", "T1105"));
        THREAT_TYPE_TO_TECHNIQUES.put("TROJAN", List.of("T1059", "T1204.002", "T1036", "T1105"));
        THREAT_TYPE_TO_TECHNIQUES.put("WEBSHELL", List.of("T1505.003", "T1059.004", "T1190"));
        THREAT_TYPE_TO_TECHNIQUES.put("REVERSE_SHELL", List.of("T1059.004", "T1071.001", "T1573"));
        THREAT_TYPE_TO_TECHNIQUES.put("ROOTKIT", List.of("T1014", "T1542.003", "T1564"));

        // Initial Access
        THREAT_TYPE_TO_TECHNIQUES.put("PHISHING", List.of("T1566", "T1566.001", "T1566.002", "T1598", "T1204.001"));
        THREAT_TYPE_TO_TECHNIQUES.put("SPEAR_PHISHING", List.of("T1566.001", "T1566.002", "T1598.003"));
        THREAT_TYPE_TO_TECHNIQUES.put("DRIVE_BY", List.of("T1189", "T1203"));
        THREAT_TYPE_TO_TECHNIQUES.put("SUPPLY_CHAIN", List.of("T1195", "T1195.001", "T1195.002"));
        THREAT_TYPE_TO_TECHNIQUES.put("TRUSTED_RELATIONSHIP", List.of("T1199"));

        // Reconnaissance / Scanning
        THREAT_TYPE_TO_TECHNIQUES.put("PORT_SCAN", List.of("T1046", "T1595", "T1595.001"));
        THREAT_TYPE_TO_TECHNIQUES.put("VULNERABILITY_SCAN", List.of("T1595.002", "T1595", "T1046"));
        THREAT_TYPE_TO_TECHNIQUES.put("RECONNAISSANCE", List.of("T1595", "T1592", "T1590", "T1589", "T1593"));
        THREAT_TYPE_TO_TECHNIQUES.put("NETWORK_SCAN", List.of("T1046", "T1595.001", "T1016", "T1018"));
        THREAT_TYPE_TO_TECHNIQUES.put("DNS_RECON", List.of("T1590.002", "T1596.001"));
        THREAT_TYPE_TO_TECHNIQUES.put("WEB_CRAWL", List.of("T1595.003", "T1594", "T1593.002"));

        // Web Application Attacks
        THREAT_TYPE_TO_TECHNIQUES.put("SQL_INJECTION", List.of("T1190", "T1059"));
        THREAT_TYPE_TO_TECHNIQUES.put("XSS", List.of("T1190", "T1059.007"));
        THREAT_TYPE_TO_TECHNIQUES.put("COMMAND_INJECTION", List.of("T1190", "T1059", "T1059.004"));
        THREAT_TYPE_TO_TECHNIQUES.put("PATH_TRAVERSAL", List.of("T1190", "T1083"));
        THREAT_TYPE_TO_TECHNIQUES.put("FILE_INCLUSION", List.of("T1190", "T1059"));
        THREAT_TYPE_TO_TECHNIQUES.put("SSRF", List.of("T1190"));
        THREAT_TYPE_TO_TECHNIQUES.put("CSRF", List.of("T1190"));
        THREAT_TYPE_TO_TECHNIQUES.put("DESERIALIZATION", List.of("T1190", "T1059"));

        // Exploit / General
        THREAT_TYPE_TO_TECHNIQUES.put("EXPLOIT", List.of("T1190", "T1203", "T1068", "T1210"));
        THREAT_TYPE_TO_TECHNIQUES.put("ZERO_DAY", List.of("T1190", "T1203", "T1068"));
        THREAT_TYPE_TO_TECHNIQUES.put("BUFFER_OVERFLOW", List.of("T1190", "T1068", "T1203"));
        THREAT_TYPE_TO_TECHNIQUES.put("RCE", List.of("T1190", "T1059", "T1203"));

        // Unauthorized Access
        THREAT_TYPE_TO_TECHNIQUES.put("UNAUTHORIZED_ACCESS", List.of("T1078", "T1021", "T1133"));
        THREAT_TYPE_TO_TECHNIQUES.put("ACCOUNT_COMPROMISE", List.of("T1078", "T1078.001", "T1078.002", "T1078.003"));

        // C2 / Exfiltration
        THREAT_TYPE_TO_TECHNIQUES.put("C2", List.of("T1071", "T1071.001", "T1071.004", "T1573", "T1572", "T1090", "T1105"));
        THREAT_TYPE_TO_TECHNIQUES.put("C2_BEACON", List.of("T1071.001", "T1573", "T1568.002", "T1102"));
        THREAT_TYPE_TO_TECHNIQUES.put("DNS_TUNNELING", List.of("T1071.004", "T1572", "T1048"));
        THREAT_TYPE_TO_TECHNIQUES.put("DATA_EXFILTRATION", List.of("T1041", "T1048", "T1567", "T1020"));
        THREAT_TYPE_TO_TECHNIQUES.put("EXFILTRATION", List.of("T1041", "T1048", "T1567", "T1567.002"));

        // Lateral Movement
        THREAT_TYPE_TO_TECHNIQUES.put("LATERAL_MOVEMENT", List.of("T1021", "T1021.001", "T1021.002", "T1021.004", "T1210", "T1570"));
        THREAT_TYPE_TO_TECHNIQUES.put("PASS_THE_HASH", List.of("T1550.002", "T1021.002"));
        THREAT_TYPE_TO_TECHNIQUES.put("PASS_THE_TICKET", List.of("T1550.003", "T1558"));
        THREAT_TYPE_TO_TECHNIQUES.put("RDP_ABUSE", List.of("T1021.001", "T1563.002"));
        THREAT_TYPE_TO_TECHNIQUES.put("SSH_ABUSE", List.of("T1021.004", "T1563.001"));

        // Privilege Escalation
        THREAT_TYPE_TO_TECHNIQUES.put("PRIVILEGE_ESCALATION", List.of("T1068", "T1548", "T1134", "T1055", "T1078"));
        THREAT_TYPE_TO_TECHNIQUES.put("UAC_BYPASS", List.of("T1548.002"));
        THREAT_TYPE_TO_TECHNIQUES.put("SUDO_ABUSE", List.of("T1548.003"));
        THREAT_TYPE_TO_TECHNIQUES.put("PROCESS_INJECTION", List.of("T1055", "T1055.001", "T1055.012"));
        THREAT_TYPE_TO_TECHNIQUES.put("CONTAINER_ESCAPE", List.of("T1611"));

        // Defense Evasion
        THREAT_TYPE_TO_TECHNIQUES.put("DEFENSE_EVASION", List.of("T1562", "T1027", "T1070", "T1036", "T1140"));
        THREAT_TYPE_TO_TECHNIQUES.put("LOG_TAMPERING", List.of("T1070", "T1070.001", "T1070.002", "T1070.003"));
        THREAT_TYPE_TO_TECHNIQUES.put("AV_EVASION", List.of("T1562.001", "T1027.002", "T1036"));
        THREAT_TYPE_TO_TECHNIQUES.put("OBFUSCATION", List.of("T1027", "T1027.002", "T1027.010", "T1140"));
        THREAT_TYPE_TO_TECHNIQUES.put("INDICATOR_REMOVAL", List.of("T1070", "T1070.004", "T1070.006"));
        THREAT_TYPE_TO_TECHNIQUES.put("MASQUERADING", List.of("T1036", "T1036.003", "T1036.005"));

        // Persistence
        THREAT_TYPE_TO_TECHNIQUES.put("PERSISTENCE", List.of("T1053", "T1547", "T1133", "T1136", "T1543", "T1505.003"));
        THREAT_TYPE_TO_TECHNIQUES.put("BACKDOOR", List.of("T1505.003", "T1547.001", "T1543.002", "T1098.004"));
        THREAT_TYPE_TO_TECHNIQUES.put("SCHEDULED_TASK", List.of("T1053", "T1053.003", "T1053.005"));
        THREAT_TYPE_TO_TECHNIQUES.put("ACCOUNT_CREATION", List.of("T1136", "T1136.001", "T1136.002", "T1136.003"));

        // Discovery
        THREAT_TYPE_TO_TECHNIQUES.put("INTERNAL_RECON", List.of("T1082", "T1083", "T1057", "T1018", "T1016", "T1049"));
        THREAT_TYPE_TO_TECHNIQUES.put("ACCOUNT_ENUMERATION", List.of("T1087", "T1087.001", "T1087.002"));
        THREAT_TYPE_TO_TECHNIQUES.put("NETWORK_DISCOVERY", List.of("T1046", "T1135", "T1018", "T1040"));

        // Collection
        THREAT_TYPE_TO_TECHNIQUES.put("DATA_COLLECTION", List.of("T1005", "T1039", "T1074", "T1119", "T1560"));
        THREAT_TYPE_TO_TECHNIQUES.put("KEYLOGGING", List.of("T1056.001", "T1056"));
        THREAT_TYPE_TO_TECHNIQUES.put("SCREEN_CAPTURE", List.of("T1113"));
        THREAT_TYPE_TO_TECHNIQUES.put("EMAIL_COLLECTION", List.of("T1114", "T1114.001", "T1114.002"));

        // Man-in-the-Middle
        THREAT_TYPE_TO_TECHNIQUES.put("MITM", List.of("T1557", "T1557.001", "T1557.002", "T1040"));
        THREAT_TYPE_TO_TECHNIQUES.put("ARP_POISONING", List.of("T1557.002"));
        THREAT_TYPE_TO_TECHNIQUES.put("DNS_SPOOFING", List.of("T1557", "T1071.004"));

        // Misc/Legacy Suricata categories
        THREAT_TYPE_TO_TECHNIQUES.put("MISC_ATTACK", List.of("T1190", "T1059"));
        THREAT_TYPE_TO_TECHNIQUES.put("ATTEMPTED_ADMIN", List.of("T1078", "T1068", "T1548"));
        THREAT_TYPE_TO_TECHNIQUES.put("ATTEMPTED_USER", List.of("T1078", "T1110"));
        THREAT_TYPE_TO_TECHNIQUES.put("WEB_APPLICATION_ATTACK", List.of("T1190", "T1059.007", "T1203"));
        THREAT_TYPE_TO_TECHNIQUES.put("SHELLCODE", List.of("T1059", "T1203", "T1620"));
        THREAT_TYPE_TO_TECHNIQUES.put("SUSPICIOUS_TRAFFIC", List.of("T1071", "T1571", "T1095"));
        THREAT_TYPE_TO_TECHNIQUES.put("POLICY_VIOLATION", List.of("T1071", "T1090"));
        THREAT_TYPE_TO_TECHNIQUES.put("TROJAN_ACTIVITY", List.of("T1059", "T1105", "T1071.001", "T1573"));
        THREAT_TYPE_TO_TECHNIQUES.put("INFO_LEAK", List.of("T1005", "T1041", "T1567"));
        THREAT_TYPE_TO_TECHNIQUES.put("NETWORK_ANOMALY", List.of("T1071", "T1095", "T1571", "T1572"));
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
