package com.blackwolf.backend.controller;

import com.blackwolf.backend.dto.DashboardDTOs.DashboardOverview;
import com.blackwolf.backend.service.DashboardService;
import com.blackwolf.backend.service.RiskScoringService;
import com.blackwolf.backend.util.AuthUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/dashboard")
public class DashboardController {

    @Autowired
    private DashboardService dashboardService;

    @Autowired
    private RiskScoringService riskScoringService;

    @Autowired
    private AuthUtils authUtils;

    @GetMapping("/overview")
    public ResponseEntity<DashboardOverview> getOverview(Authentication authentication) {
        String companyId = authUtils.getCompanyId(authentication);
        return ResponseEntity.ok(dashboardService.getOverviewForCompany(companyId));
    }

    @GetMapping("/risk-score")
    public ResponseEntity<Map<String, Object>> getRiskScore(Authentication authentication) {
        String companyId = authUtils.getCompanyId(authentication);
        return ResponseEntity.ok(riskScoringService.calculateRiskScore(companyId));
    }
}
