package com.blackwolf.backend.service;

import com.blackwolf.backend.model.*;
import com.blackwolf.backend.repository.*;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.*;

@Service
@Slf4j
public class DeceptionService {

    @Autowired
    private HoneyTokenRepository honeyTokenRepository;

    @Autowired
    private HoneyEventRepository honeyEventRepository;

    // --- Tokens ---

    public List<HoneyToken> getTokens(String companyId) {
        return honeyTokenRepository.findByCompanyIdOrderByDeployedAtDesc(companyId);
    }

    public HoneyToken createToken(String companyId, HoneyToken token) {
        token.setCompanyId(companyId);
        token.setDeployedAt(LocalDateTime.now());
        token.setActive(true);
        token.setHitCount(0);
        HoneyToken saved = honeyTokenRepository.save(token);
        log.info("[Deception] HoneyToken deployed: id={} type={} name='{}'",
                saved.getId(), saved.getTokenType(), saved.getName());
        return saved;
    }

    public HoneyToken deactivateToken(Long id) {
        HoneyToken token = honeyTokenRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("HoneyToken not found: " + id));
        token.setActive(false);
        log.info("[Deception] HoneyToken deactivated: id={}", id);
        return honeyTokenRepository.save(token);
    }

    // --- Events ---

    public HoneyEvent recordHit(Long tokenId, HoneyEvent event) {
        event.setTokenId(tokenId);
        if (event.getTimestamp() == null) {
            event.setTimestamp(LocalDateTime.now());
        }
        HoneyEvent saved = honeyEventRepository.save(event);

        honeyTokenRepository.findById(tokenId).ifPresent(token -> {
            int current = token.getHitCount() == null ? 0 : token.getHitCount();
            token.setHitCount(current + 1);
            honeyTokenRepository.save(token);
            log.warn("[Deception] HoneyToken '{}' (id={}) was accessed from {} — total hits: {}",
                    token.getName(), tokenId, event.getSourceIp(), current + 1);
        });

        return saved;
    }

    public List<HoneyEvent> getEvents(Long tokenId) {
        return honeyEventRepository.findByTokenIdOrderByTimestampDesc(tokenId);
    }

    // --- Stats ---

    public Map<String, Object> getStats(String companyId) {
        List<HoneyToken> activeTokens = honeyTokenRepository.findByCompanyIdAndActive(companyId, true);
        List<HoneyToken> allTokens = honeyTokenRepository.findByCompanyIdOrderByDeployedAtDesc(companyId);

        long totalHits = allTokens.stream()
                .mapToLong(t -> t.getHitCount() == null ? 0L : t.getHitCount())
                .sum();

        LocalDateTime last24h = LocalDateTime.now().minusHours(24);
        long recentHits = allTokens.stream()
                .mapToLong(t -> honeyEventRepository.findByTokenIdOrderByTimestampDesc(t.getId()).stream()
                        .filter(e -> e.getTimestamp() != null && e.getTimestamp().isAfter(last24h))
                        .count())
                .sum();

        Map<String, Object> stats = new LinkedHashMap<>();
        stats.put("activeTokens", activeTokens.size());
        stats.put("totalHits", totalHits);
        stats.put("recentHits", recentHits);
        return stats;
    }
}
