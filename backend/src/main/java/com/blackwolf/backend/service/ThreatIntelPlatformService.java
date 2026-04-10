package com.blackwolf.backend.service;

import com.blackwolf.backend.model.*;
import com.blackwolf.backend.repository.*;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.*;

@Service
@Slf4j
public class ThreatIntelPlatformService {

    @Autowired
    private IocEntryRepository iocEntryRepository;

    @Autowired
    private StixFeedRepository stixFeedRepository;

    public Page<IocEntry> getIocs(String companyId, Pageable pageable) {
        log.debug("Fetching IOCs for company {}", companyId);
        return iocEntryRepository.findByCompanyIdOrderByLastSeenDesc(companyId, pageable);
    }

    public IocEntry addIoc(String companyId, IocEntry ioc) {
        log.info("Adding IOC for company {}: type={}, value={}", companyId, ioc.getIocType(), ioc.getValue());
        ioc.setCompanyId(companyId);
        ioc.setFirstSeen(LocalDateTime.now());
        ioc.setLastSeen(LocalDateTime.now());
        ioc.setActive(true);
        return iocEntryRepository.save(ioc);
    }

    public Optional<IocEntry> checkIoc(String value, String type) {
        log.debug("Checking IOC: type={}, value={}", type, value);
        Optional<IocEntry> ioc = iocEntryRepository.findByValueAndIocType(value, type);
        return ioc.filter(entry -> Boolean.TRUE.equals(entry.getActive()));
    }

    public Map<String, Object> enrichThreat(String indicator) {
        log.debug("Enriching threat indicator: {}", indicator);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("indicator", indicator);

        // Check internal IOC database across common types
        List<String> typesToCheck = List.of("ip", "domain", "url", "hash", "email");
        IocEntry match = null;
        for (String type : typesToCheck) {
            Optional<IocEntry> found = iocEntryRepository.findByValueAndIocType(indicator, type);
            if (found.isPresent()) {
                match = found.get();
                break;
            }
        }

        if (match != null) {
            result.put("found", true);
            result.put("iocType", match.getIocType());
            result.put("severity", match.getSeverity());
            result.put("confidence", match.getConfidence());
            result.put("source", match.getSource());
            result.put("active", match.getActive());
            result.put("firstSeen", match.getFirstSeen());
            result.put("lastSeen", match.getLastSeen());
            result.put("tags", match.getTags());
        } else {
            result.put("found", false);
            result.put("message", "Indicator not found in internal IOC database");
        }

        return result;
    }

    public List<StixFeed> getFeeds(String companyId) {
        log.debug("Fetching STIX feeds for company {}", companyId);
        return stixFeedRepository.findByCompanyIdOrderByCreatedAtDesc(companyId);
    }

    public StixFeed addFeed(String companyId, StixFeed feed) {
        log.info("Adding STIX feed for company {}: {}", companyId, feed.getName());
        feed.setCompanyId(companyId);
        feed.setCreatedAt(LocalDateTime.now());
        if (feed.getEnabled() == null) {
            feed.setEnabled(true);
        }
        if (feed.getIocCount() == null) {
            feed.setIocCount(0);
        }
        return stixFeedRepository.save(feed);
    }

    public void deleteFeed(Long id) {
        log.info("Deleting STIX feed with id {}", id);
        stixFeedRepository.deleteById(id);
    }

    public Map<String, Object> getFeedStats(String companyId) {
        log.debug("Getting feed stats for company {}", companyId);

        List<StixFeed> feeds = stixFeedRepository.findByCompanyIdOrderByCreatedAtDesc(companyId);
        long totalFeeds = feeds.size();
        long totalIocCount = feeds.stream()
                .mapToLong(f -> f.getIocCount() != null ? f.getIocCount() : 0L)
                .sum();

        List<IocEntry> allIocs = iocEntryRepository.findByCompanyIdAndActive(companyId, true);
        long activeIocs = allIocs.size();

        Map<String, Object> stats = new LinkedHashMap<>();
        stats.put("totalFeeds", totalFeeds);
        stats.put("totalIocs", totalIocCount);
        stats.put("activeIocs", activeIocs);
        return stats;
    }
}
