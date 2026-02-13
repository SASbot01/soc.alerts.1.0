package com.blackwolf.backend.controller;

import com.blackwolf.backend.dto.AuthDTOs.*;
import com.blackwolf.backend.model.Company;
import com.blackwolf.backend.service.AuthService;
import com.blackwolf.backend.util.AuthUtils;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

    @Autowired
    private AuthService authService;

    @Autowired
    private AuthUtils authUtils;

    @Value("${jwt.expiration}")
    private int jwtExpirationInMs;

    @Value("${jwt.cookie-secure:false}")
    private boolean cookieSecure;

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(
            @Valid @RequestBody LoginRequest loginRequest,
            HttpServletRequest request,
            HttpServletResponse response) {

        String ipAddress = getClientIp(request);
        AuthResponse authResponse = authService.login(loginRequest, ipAddress);

        // Set httpOnly cookies
        addAccessTokenCookie(response, authResponse.getAccessToken());
        addRefreshTokenCookie(response, authResponse.getRefreshToken());

        return ResponseEntity.ok(authResponse);
    }

    @PostMapping("/refresh")
    public ResponseEntity<AuthResponse> refresh(
            @RequestBody(required = false) RefreshRequest refreshRequest,
            HttpServletRequest request,
            HttpServletResponse response) {

        String ipAddress = getClientIp(request);

        // Try refresh token from body first, then from cookie
        String refreshToken = null;
        if (refreshRequest != null && refreshRequest.getRefreshToken() != null) {
            refreshToken = refreshRequest.getRefreshToken();
        } else if (request.getCookies() != null) {
            for (Cookie cookie : request.getCookies()) {
                if ("refresh_token".equals(cookie.getName())) {
                    refreshToken = cookie.getValue();
                    break;
                }
            }
        }

        if (refreshToken == null) {
            return ResponseEntity.status(401).build();
        }

        AuthResponse authResponse = authService.refreshToken(refreshToken, ipAddress);

        // Update cookies
        addAccessTokenCookie(response, authResponse.getAccessToken());
        addRefreshTokenCookie(response, authResponse.getRefreshToken());

        return ResponseEntity.ok(authResponse);
    }

    @PostMapping("/logout")
    public ResponseEntity<Map<String, String>> logout(
            @RequestBody(required = false) RefreshRequest refreshRequest,
            HttpServletRequest request,
            HttpServletResponse response) {

        String refreshToken = null;
        if (refreshRequest != null && refreshRequest.getRefreshToken() != null) {
            refreshToken = refreshRequest.getRefreshToken();
        } else if (request.getCookies() != null) {
            for (Cookie cookie : request.getCookies()) {
                if ("refresh_token".equals(cookie.getName())) {
                    refreshToken = cookie.getValue();
                    break;
                }
            }
        }

        authService.logout(refreshToken);

        // Clear cookies
        clearCookie(response, "access_token");
        clearCookie(response, "refresh_token");

        return ResponseEntity.ok(Map.of("message", "Logged out successfully"));
    }

    @PostMapping("/logout-all")
    public ResponseEntity<Map<String, String>> logoutAll(
            Authentication authentication,
            HttpServletResponse response) {

        String userId = authUtils.getUserId(authentication);
        authService.logoutAll(userId);

        clearCookie(response, "access_token");
        clearCookie(response, "refresh_token");

        return ResponseEntity.ok(Map.of("message", "All sessions terminated"));
    }

    @PostMapping("/register")
    public ResponseEntity<Company> register(
            @Valid @RequestBody RegisterRequest registerRequest,
            HttpServletRequest request) {

        String ipAddress = getClientIp(request);
        return ResponseEntity.ok(authService.register(registerRequest, ipAddress));
    }

    private void addAccessTokenCookie(HttpServletResponse response, String token) {
        Cookie cookie = new Cookie("access_token", token);
        cookie.setHttpOnly(true);
        cookie.setSecure(cookieSecure);
        cookie.setPath("/");
        cookie.setMaxAge(jwtExpirationInMs / 1000);
        cookie.setAttribute("SameSite", "Lax");
        response.addCookie(cookie);
    }

    private void addRefreshTokenCookie(HttpServletResponse response, String token) {
        Cookie cookie = new Cookie("refresh_token", token);
        cookie.setHttpOnly(true);
        cookie.setSecure(cookieSecure);
        cookie.setPath("/");
        cookie.setMaxAge(7 * 24 * 60 * 60); // 7 days
        cookie.setAttribute("SameSite", "Lax");
        response.addCookie(cookie);
    }

    private void clearCookie(HttpServletResponse response, String name) {
        Cookie cookie = new Cookie(name, "");
        cookie.setHttpOnly(true);
        cookie.setSecure(cookieSecure);
        cookie.setPath("/");
        cookie.setMaxAge(0);
        cookie.setAttribute("SameSite", "Lax");
        response.addCookie(cookie);
    }

    private String getClientIp(HttpServletRequest request) {
        String xForwardedFor = request.getHeader("X-Forwarded-For");
        if (xForwardedFor != null && !xForwardedFor.isEmpty()) {
            return xForwardedFor.split(",")[0].trim();
        }
        String xRealIp = request.getHeader("X-Real-IP");
        if (xRealIp != null && !xRealIp.isEmpty()) {
            return xRealIp;
        }
        return request.getRemoteAddr();
    }
}
