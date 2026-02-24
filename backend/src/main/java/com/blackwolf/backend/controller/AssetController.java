package com.blackwolf.backend.controller;

import com.blackwolf.backend.dto.AssetDTOs.*;
import com.blackwolf.backend.dto.BillingDTOs.PlanEnforcementResult;
import com.blackwolf.backend.model.Asset;
import com.blackwolf.backend.service.AssetService;
import com.blackwolf.backend.service.BillingService;
import com.blackwolf.backend.util.AuthUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/assets")
public class AssetController {

    @Autowired
    private AssetService assetService;

    @Autowired
    private BillingService billingService;

    @Autowired
    private AuthUtils authUtils;

    @GetMapping
    @PreAuthorize("@perm.has(authentication, 'assets:read')")
    public ResponseEntity<List<Asset>> list(
            Authentication auth,
            @RequestParam(required = false) String assetType,
            @RequestParam(required = false) String criticality) {
        String companyId = authUtils.getCompanyId(auth);
        return ResponseEntity.ok(assetService.listByCompany(companyId, assetType, criticality));
    }

    @GetMapping("/{id}")
    @PreAuthorize("@perm.has(authentication, 'assets:read')")
    public ResponseEntity<AssetDetailResponse> getDetail(Authentication auth, @PathVariable String id) {
        return ResponseEntity.ok(assetService.getDetail(id, authUtils.getCompanyId(auth)));
    }

    @PostMapping
    @PreAuthorize("@perm.has(authentication, 'assets:write')")
    public ResponseEntity<?> create(Authentication auth, @RequestBody CreateAssetRequest request) {
        String companyId = authUtils.getCompanyId(auth);

        PlanEnforcementResult check = billingService.canAddAsset(companyId);
        if (!check.isAllowed()) {
            return ResponseEntity.status(403).body(java.util.Map.of(
                    "error", "plan_limit_exceeded",
                    "message", check.getReason(),
                    "current", check.getCurrent(),
                    "max", check.getMax()
            ));
        }

        String performedBy = authUtils.getUser(auth).getEmail();
        return ResponseEntity.ok(assetService.createAsset(companyId, request, performedBy));
    }

    @PutMapping("/{id}")
    @PreAuthorize("@perm.has(authentication, 'assets:write')")
    public ResponseEntity<Asset> update(Authentication auth, @PathVariable String id,
                                        @RequestBody UpdateAssetRequest request) {
        String companyId = authUtils.getCompanyId(auth);
        String performedBy = authUtils.getUser(auth).getEmail();
        return ResponseEntity.ok(assetService.updateAsset(id, companyId, request, performedBy));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("@perm.has(authentication, 'assets:delete')")
    public ResponseEntity<Void> delete(Authentication auth, @PathVariable String id) {
        String companyId = authUtils.getCompanyId(auth);
        String performedBy = authUtils.getUser(auth).getEmail();
        assetService.deleteAsset(id, companyId, performedBy);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/dashboard")
    @PreAuthorize("@perm.has(authentication, 'assets:read')")
    public ResponseEntity<AssetDashboard> getDashboard(Authentication auth) {
        return ResponseEntity.ok(assetService.getDashboard(authUtils.getCompanyId(auth)));
    }
}
