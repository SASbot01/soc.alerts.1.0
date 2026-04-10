package com.blackwolf.backend.controller;

import com.blackwolf.backend.model.AsmDiscovery;
import com.blackwolf.backend.model.AsmDomain;
import com.blackwolf.backend.repository.AsmDiscoveryRepository;
import com.blackwolf.backend.repository.AsmDomainRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/asm")
@RequiredArgsConstructor
public class AsmController {

    private final AsmDomainRepository asmDomainRepository;
    private final AsmDiscoveryRepository asmDiscoveryRepository;

    @GetMapping("/domains")
    public ResponseEntity<List<AsmDomain>> listDomains(@RequestParam String companyId) {
        return ResponseEntity.ok(asmDomainRepository.findByCompanyIdOrderByDiscoveredAtDesc(companyId));
    }

    @PostMapping("/domains")
    public ResponseEntity<AsmDomain> saveDomain(
            @RequestParam String companyId,
            @RequestBody AsmDomain domain) {
        domain.setCompanyId(companyId);
        return ResponseEntity.ok(asmDomainRepository.save(domain));
    }

    @GetMapping("/domains/{id}/discoveries")
    public ResponseEntity<List<AsmDiscovery>> listDiscoveries(@PathVariable Long id) {
        return ResponseEntity.ok(asmDiscoveryRepository.findByDomainIdOrderByFirstSeenDesc(id));
    }

    @PostMapping("/domains/{id}/discoveries")
    public ResponseEntity<AsmDiscovery> saveDiscovery(
            @PathVariable Long id,
            @RequestBody AsmDiscovery discovery) {
        discovery.setDomainId(id);
        return ResponseEntity.ok(asmDiscoveryRepository.save(discovery));
    }

    @GetMapping("/stats")
    public ResponseEntity<Map<String, Object>> getStats(@RequestParam String companyId) {
        List<AsmDomain> domains = asmDomainRepository.findByCompanyIdOrderByDiscoveredAtDesc(companyId);
        long domainCount = domains.size();
        long discoveryCount = domains.stream()
                .mapToLong(d -> asmDiscoveryRepository.findByDomainIdOrderByFirstSeenDesc(d.getId()).size())
                .sum();
        long highRiskCount = domains.stream()
                .mapToLong(d -> asmDiscoveryRepository.countByDomainIdAndRiskLevel(d.getId(), "HIGH"))
                .sum();

        Map<String, Object> stats = new HashMap<>();
        stats.put("domainCount", domainCount);
        stats.put("discoveryCount", discoveryCount);
        stats.put("highRiskCount", highRiskCount);
        return ResponseEntity.ok(stats);
    }
}
