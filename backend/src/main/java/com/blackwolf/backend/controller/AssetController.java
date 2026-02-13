package com.blackwolf.backend.controller;

import com.blackwolf.backend.dto.AssetDTOs.*;
import com.blackwolf.backend.model.Asset;
import com.blackwolf.backend.service.AssetService;
import com.blackwolf.backend.util.AuthUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/assets")
public class AssetController {

    @Autowired
    private AssetService assetService;

    @Autowired
    private AuthUtils authUtils;

    @GetMapping
    public ResponseEntity<List<Asset>> list(
            Authentication auth,
            @RequestParam(required = false) String assetType,
            @RequestParam(required = false) String criticality) {
        String companyId = authUtils.getCompanyId(auth);
        return ResponseEntity.ok(assetService.listByCompany(companyId, assetType, criticality));
    }

    @GetMapping("/{id}")
    public ResponseEntity<AssetDetailResponse> getDetail(Authentication auth, @PathVariable String id) {
        return ResponseEntity.ok(assetService.getDetail(id, authUtils.getCompanyId(auth)));
    }

    @PostMapping
    public ResponseEntity<Asset> create(Authentication auth, @RequestBody CreateAssetRequest request) {
        String companyId = authUtils.getCompanyId(auth);
        String performedBy = authUtils.getUser(auth).getEmail();
        return ResponseEntity.ok(assetService.createAsset(companyId, request, performedBy));
    }

    @PutMapping("/{id}")
    public ResponseEntity<Asset> update(Authentication auth, @PathVariable String id,
                                        @RequestBody UpdateAssetRequest request) {
        String companyId = authUtils.getCompanyId(auth);
        String performedBy = authUtils.getUser(auth).getEmail();
        return ResponseEntity.ok(assetService.updateAsset(id, companyId, request, performedBy));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(Authentication auth, @PathVariable String id) {
        String companyId = authUtils.getCompanyId(auth);
        String performedBy = authUtils.getUser(auth).getEmail();
        assetService.deleteAsset(id, companyId, performedBy);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/dashboard")
    public ResponseEntity<AssetDashboard> getDashboard(Authentication auth) {
        return ResponseEntity.ok(assetService.getDashboard(authUtils.getCompanyId(auth)));
    }
}
