package com.blackwolf.backend.security;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.stereotype.Component;

@Component("perm")
public class PermissionChecker {

    /**
     * Check if the authenticated user has a specific permission.
     * Superadmins always pass.
     */
    public boolean has(Authentication auth, String permission) {
        if (auth == null) return false;

        for (GrantedAuthority authority : auth.getAuthorities()) {
            String a = authority.getAuthority();
            // Superadmin has all permissions
            if ("ROLE_SUPERADMIN".equals(a)) return true;
            // Check exact permission match
            if (permission.equals(a)) return true;
        }
        return false;
    }

    /**
     * Check if the user has any of the given permissions.
     */
    public boolean hasAny(Authentication auth, String... permissions) {
        if (auth == null) return false;

        for (GrantedAuthority authority : auth.getAuthorities()) {
            String a = authority.getAuthority();
            if ("ROLE_SUPERADMIN".equals(a)) return true;
            for (String permission : permissions) {
                if (permission.equals(a)) return true;
            }
        }
        return false;
    }
}
