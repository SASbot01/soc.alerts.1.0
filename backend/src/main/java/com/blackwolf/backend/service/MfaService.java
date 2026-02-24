package com.blackwolf.backend.service;

import com.blackwolf.backend.model.User;
import com.blackwolf.backend.repository.UserRepository;
import dev.samstevens.totp.code.*;
import dev.samstevens.totp.exceptions.QrGenerationException;
import dev.samstevens.totp.qr.QrData;
import dev.samstevens.totp.qr.ZxingPngQrGenerator;
import dev.samstevens.totp.secret.DefaultSecretGenerator;
import dev.samstevens.totp.secret.SecretGenerator;
import dev.samstevens.totp.time.SystemTimeProvider;
import dev.samstevens.totp.time.TimeProvider;
import dev.samstevens.totp.code.HashingAlgorithm;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.UUID;

@Service
public class MfaService {

    private static final Logger log = LoggerFactory.getLogger(MfaService.class);
    private static final String ISSUER = "BlackWolf SOC";

    @Autowired
    private UserRepository userRepository;

    private final SecretGenerator secretGenerator = new DefaultSecretGenerator();
    private final TimeProvider timeProvider = new SystemTimeProvider();
    private final CodeGenerator codeGenerator = new DefaultCodeGenerator();
    private final CodeVerifier codeVerifier = new DefaultCodeVerifier(codeGenerator, timeProvider);

    /**
     * Step 1: Generate a TOTP secret + QR code for the user to scan.
     * Does NOT enable MFA yet — user must verify a code first.
     */
    @Transactional
    public MfaSetupResponse setupMfa(String userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        if (user.isMfaEnabled()) {
            throw new RuntimeException("MFA is already enabled");
        }

        String secret = secretGenerator.generate();

        // Store secret (not yet enabled)
        user.setMfaSecret(secret);
        userRepository.save(user);

        // Generate QR code
        QrData qrData = new QrData.Builder()
                .label(user.getEmail())
                .secret(secret)
                .issuer(ISSUER)
                .algorithm(HashingAlgorithm.SHA1)
                .digits(6)
                .period(30)
                .build();

        String qrCodeBase64;
        try {
            ZxingPngQrGenerator qrGenerator = new ZxingPngQrGenerator();
            byte[] imageData = qrGenerator.generate(qrData);
            qrCodeBase64 = "data:image/png;base64," + Base64.getEncoder().encodeToString(imageData);
        } catch (QrGenerationException e) {
            log.error("Failed to generate QR code: {}", e.getMessage());
            throw new RuntimeException("Failed to generate QR code");
        }

        MfaSetupResponse response = new MfaSetupResponse();
        response.setSecret(secret);
        response.setQrCode(qrCodeBase64);
        return response;
    }

    /**
     * Step 2: Verify the TOTP code and enable MFA. Generate recovery codes.
     */
    @Transactional
    public MfaVerifyResponse verifyAndEnable(String userId, String code) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        if (user.getMfaSecret() == null) {
            throw new RuntimeException("MFA setup not initiated. Call setup first.");
        }

        if (!codeVerifier.isValidCode(user.getMfaSecret(), code)) {
            throw new RuntimeException("Invalid TOTP code");
        }

        // Generate recovery codes
        List<String> recoveryCodes = generateRecoveryCodes();
        user.setMfaRecoveryCodes(String.join(",", recoveryCodes));
        user.setMfaEnabled(true);
        userRepository.save(user);

        log.info("MFA enabled for user {}", user.getEmail());

        MfaVerifyResponse response = new MfaVerifyResponse();
        response.setEnabled(true);
        response.setRecoveryCodes(recoveryCodes);
        return response;
    }

    /**
     * Disable MFA for a user (requires current password verified by caller).
     */
    @Transactional
    public void disableMfa(String userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        user.setMfaEnabled(false);
        user.setMfaSecret(null);
        user.setMfaRecoveryCodes(null);
        userRepository.save(user);

        log.info("MFA disabled for user {}", user.getEmail());
    }

    /**
     * Validate a TOTP code during login.
     */
    public boolean validateCode(User user, String code) {
        if (user.getMfaSecret() == null) return false;

        // Check TOTP code
        if (codeVerifier.isValidCode(user.getMfaSecret(), code)) {
            return true;
        }

        // Check recovery codes
        if (user.getMfaRecoveryCodes() != null) {
            List<String> codes = new ArrayList<>(List.of(user.getMfaRecoveryCodes().split(",")));
            if (codes.contains(code)) {
                codes.remove(code);
                user.setMfaRecoveryCodes(String.join(",", codes));
                userRepository.save(user);
                log.info("Recovery code used for user {}", user.getEmail());
                return true;
            }
        }

        return false;
    }

    /**
     * Check if a user has MFA enabled.
     */
    public boolean isMfaEnabled(String userId) {
        return userRepository.findById(userId)
                .map(User::isMfaEnabled)
                .orElse(false);
    }

    private List<String> generateRecoveryCodes() {
        List<String> codes = new ArrayList<>();
        for (int i = 0; i < 8; i++) {
            codes.add(UUID.randomUUID().toString().substring(0, 8).toUpperCase());
        }
        return codes;
    }

    // --- DTOs ---

    public static class MfaSetupResponse {
        private String secret;
        private String qrCode;

        public String getSecret() { return secret; }
        public void setSecret(String secret) { this.secret = secret; }
        public String getQrCode() { return qrCode; }
        public void setQrCode(String qrCode) { this.qrCode = qrCode; }
    }

    public static class MfaVerifyResponse {
        private boolean enabled;
        private List<String> recoveryCodes;

        public boolean isEnabled() { return enabled; }
        public void setEnabled(boolean enabled) { this.enabled = enabled; }
        public List<String> getRecoveryCodes() { return recoveryCodes; }
        public void setRecoveryCodes(List<String> recoveryCodes) { this.recoveryCodes = recoveryCodes; }
    }
}
