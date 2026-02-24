package com.blackwolf.backend.service;

import com.blackwolf.backend.model.Permission;
import com.blackwolf.backend.model.Role;
import com.blackwolf.backend.model.User;
import com.blackwolf.backend.repository.PermissionRepository;
import com.blackwolf.backend.repository.RoleRepository;
import com.blackwolf.backend.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class RbacService {

    private static final Logger log = LoggerFactory.getLogger(RbacService.class);

    @Autowired
    private RoleRepository roleRepository;

    @Autowired
    private PermissionRepository permissionRepository;

    @Autowired
    private UserRepository userRepository;

    /**
     * Get all permissions for a user's role.
     * First checks for a company-specific role, then falls back to system role.
     */
    public Set<String> getPermissionsForRole(String roleName, String companyId) {
        if ("superadmin".equals(roleName)) {
            // Superadmin has all permissions
            return permissionRepository.findAll().stream()
                    .map(Permission::getId)
                    .collect(Collectors.toSet());
        }

        Role role = resolveRole(roleName, companyId);
        if (role == null) {
            log.warn("No role found for name={}, companyId={}", roleName, companyId);
            return Collections.emptySet();
        }

        return role.getPermissions().stream()
                .map(Permission::getId)
                .collect(Collectors.toSet());
    }

    /**
     * Resolve role: company-specific first, then system fallback.
     */
    public Role resolveRole(String roleName, String companyId) {
        if (companyId != null) {
            Optional<Role> companyRole = roleRepository.findByNameAndCompanyId(roleName, companyId);
            if (companyRole.isPresent()) {
                return companyRole.get();
            }
        }
        return roleRepository.findByNameAndIsSystemTrue(roleName).orElse(null);
    }

    /**
     * Get all available roles for a company (system + custom).
     */
    public List<Role> getAvailableRoles(String companyId) {
        if (companyId != null) {
            return roleRepository.findByCompanyIdOrIsSystemTrue(companyId);
        }
        return roleRepository.findByIsSystemTrue();
    }

    /**
     * Get role by ID.
     */
    public Role getRoleById(String roleId) {
        return roleRepository.findById(roleId)
                .orElseThrow(() -> new RuntimeException("Role not found: " + roleId));
    }

    /**
     * Get all permissions.
     */
    public List<Permission> getAllPermissions() {
        return permissionRepository.findAll();
    }

    /**
     * Assign a role to a user.
     */
    @Transactional
    public User assignRole(String userId, String roleName) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));
        user.setRole(roleName);
        return userRepository.save(user);
    }

    /**
     * Create a custom role for a company.
     */
    @Transactional
    public Role createCustomRole(String companyId, String name, String displayName,
                                  String description, Set<String> permissionIds) {
        // Validate name uniqueness within company
        if (roleRepository.findByNameAndCompanyId(name, companyId).isPresent()) {
            throw new RuntimeException("Role '" + name + "' already exists for this company");
        }

        Role role = new Role();
        role.setId(UUID.randomUUID().toString());
        role.setName(name);
        role.setDisplayName(displayName);
        role.setDescription(description);
        role.setCompanyId(companyId);
        role.setSystem(false);
        role.setCreatedAt(LocalDateTime.now());

        Set<Permission> permissions = new HashSet<>(permissionRepository.findAllById(permissionIds));
        role.setPermissions(permissions);

        return roleRepository.save(role);
    }

    /**
     * Update a custom role's permissions.
     */
    @Transactional
    public Role updateRole(String roleId, String displayName, String description,
                            Set<String> permissionIds) {
        Role role = roleRepository.findById(roleId)
                .orElseThrow(() -> new RuntimeException("Role not found"));

        if (role.isSystem()) {
            throw new RuntimeException("Cannot modify system roles");
        }

        if (displayName != null) role.setDisplayName(displayName);
        if (description != null) role.setDescription(description);
        if (permissionIds != null) {
            Set<Permission> permissions = new HashSet<>(permissionRepository.findAllById(permissionIds));
            role.setPermissions(permissions);
        }

        return roleRepository.save(role);
    }

    /**
     * Delete a custom role.
     */
    @Transactional
    public void deleteRole(String roleId) {
        Role role = roleRepository.findById(roleId)
                .orElseThrow(() -> new RuntimeException("Role not found"));

        if (role.isSystem()) {
            throw new RuntimeException("Cannot delete system roles");
        }

        roleRepository.delete(role);
    }
}
