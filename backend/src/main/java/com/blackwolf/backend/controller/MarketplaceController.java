package com.blackwolf.backend.controller;

import com.blackwolf.backend.model.MarketplaceInstallation;
import com.blackwolf.backend.model.MarketplaceItem;
import com.blackwolf.backend.service.MarketplaceService;
import com.blackwolf.backend.util.AuthUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/marketplace")
public class MarketplaceController {

    @Autowired
    private MarketplaceService marketplaceService;

    @Autowired
    private AuthUtils authUtils;

    @GetMapping
    @PreAuthorize("@perm.has(authentication, 'settings:read')")
    public ResponseEntity<List<MarketplaceItem>> listItems(
            @RequestParam(required = false) String type,
            @RequestParam(required = false) String category) {
        return ResponseEntity.ok(marketplaceService.listItems(type, category));
    }

    @GetMapping("/{id}")
    @PreAuthorize("@perm.has(authentication, 'settings:read')")
    public ResponseEntity<MarketplaceItem> getItem(@PathVariable String id) {
        return ResponseEntity.ok(marketplaceService.getItem(id));
    }

    @PostMapping("/{id}/install")
    @PreAuthorize("@perm.has(authentication, 'settings:read')")
    public ResponseEntity<MarketplaceInstallation> install(Authentication auth, @PathVariable String id) {
        String companyId = authUtils.getCompanyId(auth);
        String userId = authUtils.getUserId(auth);
        return ResponseEntity.ok(marketplaceService.install(companyId, id, userId));
    }

    @PostMapping("/{id}/uninstall")
    @PreAuthorize("@perm.has(authentication, 'settings:read')")
    public ResponseEntity<Map<String, String>> uninstall(Authentication auth, @PathVariable String id) {
        String companyId = authUtils.getCompanyId(auth);
        String userId = authUtils.getUserId(auth);
        marketplaceService.uninstall(companyId, id, userId);
        return ResponseEntity.ok(Map.of("status", "uninstalled"));
    }

    @PostMapping("/{id}/rate")
    @PreAuthorize("@perm.has(authentication, 'settings:read')")
    public ResponseEntity<MarketplaceItem> rateItem(@PathVariable String id, @RequestBody Map<String, Double> body) {
        double rating = body.getOrDefault("rating", 0.0);
        return ResponseEntity.ok(marketplaceService.rateItem(id, rating));
    }

    @GetMapping("/installed")
    @PreAuthorize("@perm.has(authentication, 'settings:read')")
    public ResponseEntity<List<MarketplaceInstallation>> getInstalled(Authentication auth) {
        String companyId = authUtils.getCompanyId(auth);
        return ResponseEntity.ok(marketplaceService.getInstalled(companyId));
    }
}
