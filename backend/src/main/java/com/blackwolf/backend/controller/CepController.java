package com.blackwolf.backend.controller;

import com.blackwolf.backend.model.CepRule;
import com.blackwolf.backend.repository.CepRuleRepository;
import com.blackwolf.backend.service.CepEngineService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/cep")
@RequiredArgsConstructor
public class CepController {

    private final CepEngineService cepEngineService;
    private final CepRuleRepository cepRuleRepository;

    @GetMapping("/rules")
    public ResponseEntity<List<CepRule>> getRules(@RequestParam String companyId) {
        return ResponseEntity.ok(cepEngineService.getRules(companyId));
    }

    @PostMapping("/rules")
    public ResponseEntity<CepRule> createRule(
            @RequestParam String companyId,
            @RequestBody CepRule rule) {
        return ResponseEntity.ok(cepEngineService.createRule(companyId, rule));
    }

    @PutMapping("/rules/{id}")
    public ResponseEntity<CepRule> updateRule(
            @PathVariable Long id,
            @RequestBody CepRule rule) {
        return ResponseEntity.ok(cepEngineService.updateRule(id, rule));
    }

    @DeleteMapping("/rules/{id}")
    public ResponseEntity<?> deleteRule(@PathVariable Long id) {
        cepEngineService.deleteRule(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/evaluate")
    public ResponseEntity<List<String>> evaluateEvent(
            @RequestParam String companyId,
            @RequestBody Map<String, Object> event) {
        return ResponseEntity.ok(cepEngineService.evaluateEvent(companyId, event));
    }

    @GetMapping("/stats")
    public ResponseEntity<Map<String, Object>> getStats(@RequestParam String companyId) {
        List<CepRule> allRules = cepRuleRepository.findByCompanyIdOrderByCreatedAtDesc(companyId);
        List<CepRule> enabledRules = cepRuleRepository.findByCompanyIdAndEnabled(companyId, true);
        long totalHits = allRules.stream()
                .mapToLong(r -> r.getHits() != null ? r.getHits() : 0L)
                .sum();

        Map<String, Object> stats = new HashMap<>();
        stats.put("totalRules", allRules.size());
        stats.put("enabledRules", enabledRules.size());
        stats.put("totalHits", totalHits);
        return ResponseEntity.ok(stats);
    }
}
