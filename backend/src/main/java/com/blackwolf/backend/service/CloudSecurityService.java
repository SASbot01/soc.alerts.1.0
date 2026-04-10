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
public class CloudSecurityService {

    @Autowired
    private CloudAccountRepository cloudAccountRepository;

    @Autowired
    private CloudFindingRepository cloudFindingRepository;

    // --- Accounts ---

    public List<CloudAccount> getAccounts(String companyId) {
        return cloudAccountRepository.findByCompanyIdOrderByCreatedAtDesc(companyId);
    }

    public CloudAccount addAccount(String companyId, CloudAccount account) {
        account.setCompanyId(companyId);
        account.setCreatedAt(LocalDateTime.now());
        account.setEnabled(true);
        CloudAccount saved = cloudAccountRepository.save(account);
        log.info("[CSPM] Cloud account added: id={} provider={}", saved.getId(), saved.getProvider());
        return saved;
    }

    public void removeAccount(Long id) {
        cloudAccountRepository.deleteById(id);
        log.info("[CSPM] Cloud account removed: id={}", id);
    }

    // --- Findings ---

    public List<CloudFinding> getFindings(Long accountId) {
        return cloudFindingRepository.findByAccountIdOrderByFoundAtDesc(accountId);
    }

    public CloudFinding addFinding(Long accountId, CloudFinding finding) {
        finding.setAccountId(accountId);
        finding.setFoundAt(LocalDateTime.now());
        finding.setStatus("open");
        return cloudFindingRepository.save(finding);
    }

    public CloudFinding resolveFindings(Long findingId) {
        CloudFinding finding = cloudFindingRepository.findById(findingId)
                .orElseThrow(() -> new RuntimeException("CloudFinding not found: " + findingId));
        finding.setStatus("resolved");
        finding.setResolvedAt(LocalDateTime.now());
        log.info("[CSPM] Finding {} resolved", findingId);
        return cloudFindingRepository.save(finding);
    }

    // --- Stats ---

    public Map<String, Object> getStats(String companyId) {
        List<CloudAccount> accounts = cloudAccountRepository.findByCompanyIdOrderByCreatedAtDesc(companyId);

        long totalFindings = 0;
        long criticalFindings = 0;
        long resolvedFindings = 0;

        for (CloudAccount account : accounts) {
            List<CloudFinding> findings = cloudFindingRepository.findByAccountIdOrderByFoundAtDesc(account.getId());
            totalFindings += findings.size();
            criticalFindings += findings.stream()
                    .filter(f -> "critical".equalsIgnoreCase(f.getSeverity()))
                    .count();
            resolvedFindings += findings.stream()
                    .filter(f -> "resolved".equalsIgnoreCase(f.getStatus()))
                    .count();
        }

        Map<String, Object> stats = new LinkedHashMap<>();
        stats.put("totalAccounts", accounts.size());
        stats.put("totalFindings", totalFindings);
        stats.put("criticalFindings", criticalFindings);
        stats.put("resolvedFindings", resolvedFindings);
        return stats;
    }
}
