package com.blackwolf.backend.controller;

import com.blackwolf.backend.dto.OnboardingDTOs.*;
import com.blackwolf.backend.model.OnboardingRequest;
import com.blackwolf.backend.service.OnboardingService;
import com.blackwolf.backend.util.AuthUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/onboarding")
public class OnboardingController {

    @Autowired private OnboardingService onboardingService;
    @Autowired private AuthUtils authUtils;

    // Public endpoint - no auth required (configured in SecurityConfig)
    @PostMapping("/submit")
    public ResponseEntity<OnboardingRequest> submit(@RequestBody OnboardingFormRequest form) {
        return ResponseEntity.ok(onboardingService.submit(form));
    }

    // Public endpoint - submit form + create Stripe checkout (no card required, 14-day trial)
    @PostMapping("/submit-and-checkout")
    public ResponseEntity<OnboardingCheckoutResponse> submitAndCheckout(@RequestBody OnboardingFormRequest form) {
        return ResponseEntity.ok(onboardingService.submitAndCheckout(form));
    }

    // Superadmin endpoints
    @GetMapping("/requests")
    public ResponseEntity<List<OnboardingRequest>> listAll(Authentication auth) {
        if (!authUtils.isSuperAdmin(auth)) {
            return ResponseEntity.status(403).build();
        }
        return ResponseEntity.ok(onboardingService.listAll());
    }

    @GetMapping("/requests/pending")
    public ResponseEntity<List<OnboardingRequest>> listPending(Authentication auth) {
        if (!authUtils.isSuperAdmin(auth)) {
            return ResponseEntity.status(403).build();
        }
        return ResponseEntity.ok(onboardingService.listPending());
    }

    @PutMapping("/requests/{id}/review")
    public ResponseEntity<ReviewResponse> review(@PathVariable String id, @RequestBody ReviewRequest request, Authentication auth) {
        if (!authUtils.isSuperAdmin(auth)) {
            return ResponseEntity.status(403).build();
        }
        String reviewedBy = authUtils.getUserId(auth);
        return ResponseEntity.ok(onboardingService.review(id, request.getStatus(), reviewedBy));
    }
}
