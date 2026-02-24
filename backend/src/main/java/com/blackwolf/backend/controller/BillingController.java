package com.blackwolf.backend.controller;

import com.blackwolf.backend.dto.BillingDTOs.*;
import com.blackwolf.backend.service.BillingService;
import com.blackwolf.backend.service.StripeWebhookService;
import com.blackwolf.backend.util.AuthUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/billing")
public class BillingController {

    @Autowired
    private BillingService billingService;

    @Autowired
    private StripeWebhookService stripeWebhookService;

    @Autowired
    private AuthUtils authUtils;

    @GetMapping("/overview")
    @PreAuthorize("@perm.has(authentication, 'billing:read')")
    public ResponseEntity<BillingOverview> getOverview(Authentication auth) {
        String companyId = authUtils.getCompanyId(auth);
        return ResponseEntity.ok(billingService.getBillingOverview(companyId));
    }

    @GetMapping("/plans")
    @PreAuthorize("@perm.has(authentication, 'billing:read')")
    public ResponseEntity<List<PlanInfo>> getPlans(Authentication auth) {
        return ResponseEntity.ok(billingService.getPlans());
    }

    @PostMapping("/checkout")
    @PreAuthorize("@perm.has(authentication, 'billing:write')")
    public ResponseEntity<CheckoutResponse> createCheckout(Authentication auth, @RequestBody CheckoutRequest request) {
        String companyId = authUtils.getCompanyId(auth);
        return ResponseEntity.ok(billingService.createCheckoutSession(companyId, request.getPlan()));
    }

    @PostMapping("/change-plan")
    @PreAuthorize("@perm.has(authentication, 'billing:write')")
    public ResponseEntity<Map<String, String>> changePlan(Authentication auth, @RequestBody ChangePlanRequest request) {
        String companyId = authUtils.getCompanyId(auth);
        billingService.changePlan(companyId, request.getNewPlan());
        return ResponseEntity.ok(Map.of("status", "ok", "plan", request.getNewPlan()));
    }

    @PostMapping("/cancel")
    @PreAuthorize("@perm.has(authentication, 'billing:write')")
    public ResponseEntity<Map<String, String>> cancel(Authentication auth) {
        String companyId = authUtils.getCompanyId(auth);
        billingService.cancelSubscription(companyId);
        return ResponseEntity.ok(Map.of("status", "canceled"));
    }

    @PostMapping("/reactivate")
    @PreAuthorize("@perm.has(authentication, 'billing:write')")
    public ResponseEntity<Map<String, String>> reactivate(Authentication auth) {
        String companyId = authUtils.getCompanyId(auth);
        billingService.reactivateSubscription(companyId);
        return ResponseEntity.ok(Map.of("status", "active"));
    }

    @PostMapping("/portal")
    @PreAuthorize("@perm.has(authentication, 'billing:write')")
    public ResponseEntity<PortalResponse> createPortal(Authentication auth) {
        String companyId = authUtils.getCompanyId(auth);
        return ResponseEntity.ok(billingService.createPortalSession(companyId));
    }

    @PostMapping("/webhook")
    public ResponseEntity<String> handleWebhook(
            @RequestBody String payload,
            @RequestHeader(value = "Stripe-Signature", required = false) String sigHeader) {
        stripeWebhookService.handleWebhook(payload, sigHeader);
        return ResponseEntity.ok("ok");
    }
}
