package com.blackwolf.backend.dto;

import com.blackwolf.backend.model.User;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.List;

public class AuthDTOs {

    @Data
    public static class LoginRequest {
        @NotBlank(message = "Email is required")
        @Email(message = "Invalid email format")
        private String email;

        @NotBlank(message = "Password is required")
        private String password;

        private String companyDomain;
    }

    @Data
    public static class RegisterRequest {
        @NotBlank(message = "Company name is required")
        private String companyName;

        @NotBlank(message = "Domain is required")
        private String domain;

        @NotBlank(message = "Contact email is required")
        @Email(message = "Invalid email format")
        private String contactEmail;

        private String contactPhone;
        private String plan;

        @NotBlank(message = "Password is required")
        @Size(min = 12, message = "Password must be at least 12 characters")
        @Pattern(
                regexp = "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&.#^()\\-_=+])[A-Za-z\\d@$!%*?&.#^()\\-_=+]{12,}$",
                message = "Password must contain uppercase, lowercase, number, and special character"
        )
        private String password;
    }

    @Data
    public static class ChangePasswordRequest {
        @NotBlank(message = "Current password is required")
        private String currentPassword;

        @NotBlank(message = "New password is required")
        @Size(min = 12, message = "Password must be at least 12 characters")
        @Pattern(
                regexp = "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&.#^()\\-_=+])[A-Za-z\\d@$!%*?&.#^()\\-_=+]{12,}$",
                message = "Password must contain uppercase, lowercase, number, and special character"
        )
        private String newPassword;
    }

    @Data
    public static class RefreshRequest {
        private String refreshToken;
    }

    @Data
    public static class AuthResponse {
        private String accessToken;
        private String refreshToken;
        private String tokenType = "Bearer";
        private int expiresIn;
        private User user;
        private boolean requiresMfa;
        private String mfaToken;
        private List<String> permissions;

        public AuthResponse(String accessToken, String refreshToken, int expiresIn, User user) {
            this.accessToken = accessToken;
            this.refreshToken = refreshToken;
            this.expiresIn = expiresIn;
            this.user = user;
            this.requiresMfa = false;
        }

        public AuthResponse(String accessToken, String refreshToken, int expiresIn, User user, List<String> permissions) {
            this(accessToken, refreshToken, expiresIn, user);
            this.permissions = permissions;
        }

        /** MFA-pending response: no tokens, just mfaToken for second step */
        public static AuthResponse mfaPending(String mfaToken) {
            AuthResponse r = new AuthResponse(null, null, 0, null);
            r.setRequiresMfa(true);
            r.setMfaToken(mfaToken);
            return r;
        }
    }

    @Data
    public static class MfaLoginRequest {
        private String mfaToken;
        private String code;
    }
}
