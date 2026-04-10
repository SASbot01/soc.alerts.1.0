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
import java.util.stream.*;

@Service
@Slf4j
public class NetworkAnalysisService {

    @Autowired
    private NetworkFlowRepository networkFlowRepository;

    public NetworkFlow ingestFlow(String companyId, NetworkFlow flow) {
        flow.setCompanyId(companyId);
        return networkFlowRepository.save(flow);
    }

    public Page<NetworkFlow> getFlows(String companyId, LocalDateTime from, LocalDateTime to, Pageable pageable) {
        return networkFlowRepository.findByCompanyIdAndTimestampBetween(companyId, from, to, pageable);
    }

    public Page<NetworkFlow> getThreats(String companyId, Pageable pageable) {
        return networkFlowRepository.findByCompanyIdAndThreatTypeNotNull(companyId, pageable);
    }

    public List<Map<String, Object>> getTopTalkers(String companyId, int limit) {
        List<NetworkFlow> allFlows = networkFlowRepository.findAll().stream()
                .filter(f -> companyId.equals(f.getCompanyId()))
                .collect(Collectors.toList());

        Map<String, Long> bytesBySrc = new LinkedHashMap<>();
        for (NetworkFlow flow : allFlows) {
            String src = flow.getSrcIp();
            if (src == null) continue;
            long bytes = 0L;
            if (flow.getBytesSent() != null) bytes += flow.getBytesSent();
            if (flow.getBytesRecv() != null) bytes += flow.getBytesRecv();
            bytesBySrc.merge(src, bytes, Long::sum);
        }

        return bytesBySrc.entrySet().stream()
                .sorted(Map.Entry.<String, Long>comparingByValue().reversed())
                .limit(limit)
                .map(e -> {
                    Map<String, Object> entry = new LinkedHashMap<>();
                    entry.put("srcIp", e.getKey());
                    entry.put("totalBytes", e.getValue());
                    return entry;
                })
                .collect(Collectors.toList());
    }

    public Map<String, Long> getProtocolDistribution(String companyId) {
        List<NetworkFlow> allFlows = networkFlowRepository.findAll().stream()
                .filter(f -> companyId.equals(f.getCompanyId()))
                .collect(Collectors.toList());

        return allFlows.stream()
                .filter(f -> f.getProtocol() != null)
                .collect(Collectors.groupingBy(NetworkFlow::getProtocol, Collectors.counting()));
    }

    public Map<String, Object> getStats(String companyId) {
        List<NetworkFlow> allFlows = networkFlowRepository.findAll().stream()
                .filter(f -> companyId.equals(f.getCompanyId()))
                .collect(Collectors.toList());

        long totalFlows = allFlows.size();
        long threats = allFlows.stream().filter(f -> f.getThreatType() != null).count();
        long totalBytes = allFlows.stream()
                .mapToLong(f -> {
                    long b = 0L;
                    if (f.getBytesSent() != null) b += f.getBytesSent();
                    if (f.getBytesRecv() != null) b += f.getBytesRecv();
                    return b;
                })
                .sum();

        Map<String, Object> stats = new LinkedHashMap<>();
        stats.put("totalFlows", totalFlows);
        stats.put("threats", threats);
        stats.put("totalBytes", totalBytes);
        return stats;
    }
}
