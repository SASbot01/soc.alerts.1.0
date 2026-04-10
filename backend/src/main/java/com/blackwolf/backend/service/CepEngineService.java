package com.blackwolf.backend.service;

import com.blackwolf.backend.model.*;
import com.blackwolf.backend.repository.*;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.*;

@Service
@Slf4j
public class CepEngineService {

    @Autowired
    private CepRuleRepository cepRuleRepository;

    @Autowired
    private CepStateRepository cepStateRepository;

    public List<CepRule> getRules(String companyId) {
        return cepRuleRepository.findByCompanyIdOrderByCreatedAtDesc(companyId);
    }

    public CepRule createRule(String companyId, CepRule rule) {
        rule.setCompanyId(companyId);
        rule.setEnabled(true);
        rule.setHits(0L);
        rule.setCreatedAt(LocalDateTime.now());
        return cepRuleRepository.save(rule);
    }

    public CepRule updateRule(Long id, CepRule updates) {
        CepRule existing = cepRuleRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("CepRule not found: " + id));
        if (updates.getName() != null) existing.setName(updates.getName());
        if (updates.getDescription() != null) existing.setDescription(updates.getDescription());
        if (updates.getRuleType() != null) existing.setRuleType(updates.getRuleType());
        if (updates.getConditions() != null) existing.setConditions(updates.getConditions());
        if (updates.getActions() != null) existing.setActions(updates.getActions());
        if (updates.getWindowSeconds() != null) existing.setWindowSeconds(updates.getWindowSeconds());
        if (updates.getThreshold() != null) existing.setThreshold(updates.getThreshold());
        if (updates.getEnabled() != null) existing.setEnabled(updates.getEnabled());
        return cepRuleRepository.save(existing);
    }

    public void deleteRule(Long id) {
        cepStateRepository.findByRuleId(id).forEach(cepStateRepository::delete);
        cepRuleRepository.deleteById(id);
    }

    public List<String> evaluateEvent(String companyId, Map<String, Object> event) {
        List<CepRule> enabledRules = cepRuleRepository.findByCompanyIdAndEnabled(companyId, true);
        List<String> firedRules = new ArrayList<>();

        for (CepRule rule : enabledRules) {
            String stateKey = buildStateKey(rule, event);
            Optional<CepState> existingState = cepStateRepository.findByRuleIdAndStateKey(rule.getId(), stateKey);

            CepState state;
            LocalDateTime now = LocalDateTime.now();

            if (existingState.isPresent()) {
                state = existingState.get();
                if (state.getExpiresAt() != null && state.getExpiresAt().isBefore(now)) {
                    // Window expired — reset
                    state.setEventCount(1);
                    state.setFirstEvent(now);
                    int windowSec = rule.getWindowSeconds() != null ? rule.getWindowSeconds() : 300;
                    state.setExpiresAt(now.plusSeconds(windowSec));
                } else {
                    state.setEventCount(state.getEventCount() == null ? 1 : state.getEventCount() + 1);
                }
            } else {
                state = new CepState();
                state.setRuleId(rule.getId());
                state.setStateKey(stateKey);
                state.setEventCount(1);
                state.setFirstEvent(now);
                int windowSec = rule.getWindowSeconds() != null ? rule.getWindowSeconds() : 300;
                state.setExpiresAt(now.plusSeconds(windowSec));
            }

            state.setLastEvent(now);
            cepStateRepository.save(state);

            int threshold = rule.getThreshold() != null ? rule.getThreshold() : 1;
            if (state.getEventCount() >= threshold) {
                log.warn("[CEP] Rule '{}' fired for company {} — stateKey='{}' eventCount={} threshold={}",
                        rule.getName(), companyId, stateKey, state.getEventCount(), threshold);
                rule.setHits(rule.getHits() == null ? 1L : rule.getHits() + 1);
                rule.setLastHit(now);
                cepRuleRepository.save(rule);
                firedRules.add(rule.getName());
            }
        }

        return firedRules;
    }

    @Scheduled(fixedRate = 60000)
    public void cleanExpiredStates() {
        cepStateRepository.deleteByExpiresAtBefore(LocalDateTime.now());
        log.debug("[CEP] Cleaned expired CEP states");
    }

    // --- helpers ---

    private String buildStateKey(CepRule rule, Map<String, Object> event) {
        String ip = event.getOrDefault("srcIp", event.getOrDefault("sourceIp", "global")).toString();
        return rule.getId() + ":" + ip;
    }
}
