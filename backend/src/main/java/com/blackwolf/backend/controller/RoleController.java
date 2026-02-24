package com.blackwolf.backend.controller;

import com.blackwolf.backend.model.Permission;
import com.blackwolf.backend.model.Role;
import com.blackwolf.backend.service.RbacService;
import com.blackwolf.backend.util.AuthUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.Set;

@RestController
@RequestMapping("/api/v1/roles")
public class RoleController {

    @Autowired
    private RbacService rbacService;

    @Autowired
    private AuthUtils authUtils;

    @GetMapping
    @PreAuthorize("@perm.has(authentication, 'roles:read')")
    public ResponseEntity<List<Role>> listRoles(Authentication auth) {
        String companyId = authUtils.getCompanyId(auth);
        return ResponseEntity.ok(rbacService.getAvailableRoles(companyId));
    }

    @GetMapping("/{id}")
    @PreAuthorize("@perm.has(authentication, 'roles:read')")
    public ResponseEntity<Role> getRole(@PathVariable String id) {
        return ResponseEntity.ok(rbacService.getRoleById(id));
    }

    @GetMapping("/permissions")
    @PreAuthorize("@perm.has(authentication, 'roles:read')")
    public ResponseEntity<List<Permission>> listPermissions() {
        return ResponseEntity.ok(rbacService.getAllPermissions());
    }

    @PostMapping
    @PreAuthorize("@perm.has(authentication, 'roles:write')")
    public ResponseEntity<Role> createRole(
            @RequestBody Map<String, Object> body,
            Authentication auth) {
        String companyId = authUtils.getCompanyId(auth);
        String name = (String) body.get("name");
        String displayName = (String) body.get("displayName");
        String description = (String) body.get("description");
        @SuppressWarnings("unchecked")
        List<String> permissionIds = (List<String>) body.get("permissions");

        Role role = rbacService.createCustomRole(companyId, name, displayName, description,
                permissionIds != null ? Set.copyOf(permissionIds) : Set.of());
        return ResponseEntity.ok(role);
    }

    @PutMapping("/{id}")
    @PreAuthorize("@perm.has(authentication, 'roles:write')")
    public ResponseEntity<Role> updateRole(
            @PathVariable String id,
            @RequestBody Map<String, Object> body) {
        String displayName = (String) body.get("displayName");
        String description = (String) body.get("description");
        @SuppressWarnings("unchecked")
        List<String> permissionIds = (List<String>) body.get("permissions");

        Role role = rbacService.updateRole(id, displayName, description,
                permissionIds != null ? Set.copyOf(permissionIds) : null);
        return ResponseEntity.ok(role);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("@perm.has(authentication, 'roles:write')")
    public ResponseEntity<Void> deleteRole(@PathVariable String id) {
        rbacService.deleteRole(id);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/assign")
    @PreAuthorize("@perm.has(authentication, 'users:write')")
    public ResponseEntity<Map<String, String>> assignRole(@RequestBody Map<String, String> body) {
        String userId = body.get("userId");
        String roleName = body.get("role");
        rbacService.assignRole(userId, roleName);
        return ResponseEntity.ok(Map.of("message", "Role assigned successfully"));
    }
}
