package com.blackwolf.backend.controller;

import com.blackwolf.backend.service.MfaService;
import com.blackwolf.backend.util.AuthUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/mfa")
public class MfaController {

    @Autowired
    private MfaService mfaService;

    @Autowired
    private AuthUtils authUtils;

    @PostMapping("/setup")
    public ResponseEntity<MfaService.MfaSetupResponse> setup(Authentication auth) {
        String userId = authUtils.getUserId(auth);
        return ResponseEntity.ok(mfaService.setupMfa(userId));
    }

    @PostMapping("/verify")
    public ResponseEntity<MfaService.MfaVerifyResponse> verify(
            Authentication auth,
            @RequestBody Map<String, String> body) {
        String userId = authUtils.getUserId(auth);
        String code = body.get("code");
        if (code == null || code.isBlank()) {
            throw new RuntimeException("Code is required");
        }
        return ResponseEntity.ok(mfaService.verifyAndEnable(userId, code));
    }

    @PostMapping("/disable")
    public ResponseEntity<Map<String, String>> disable(Authentication auth) {
        String userId = authUtils.getUserId(auth);
        mfaService.disableMfa(userId);
        return ResponseEntity.ok(Map.of("status", "disabled"));
    }

    @GetMapping("/status")
    public ResponseEntity<Map<String, Boolean>> status(Authentication auth) {
        String userId = authUtils.getUserId(auth);
        boolean enabled = mfaService.isMfaEnabled(userId);
        return ResponseEntity.ok(Map.of("mfaEnabled", enabled));
    }
}
