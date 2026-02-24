package com.blackwolf.backend.controller;

import com.blackwolf.backend.dto.UserDTOs.*;
import com.blackwolf.backend.dto.BillingDTOs.PlanEnforcementResult;
import com.blackwolf.backend.model.User;
import com.blackwolf.backend.service.BillingService;
import com.blackwolf.backend.service.UserService;
import com.blackwolf.backend.util.AuthUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/users")
public class UserController {

    @Autowired
    private UserService userService;

    @Autowired
    private BillingService billingService;

    @Autowired
    private AuthUtils authUtils;

    @GetMapping
    @PreAuthorize("@perm.has(authentication, 'users:read')")
    public ResponseEntity<List<User>> listUsers(Authentication authentication) {
        String companyId = authUtils.getCompanyId(authentication);
        return ResponseEntity.ok(userService.listByCompany(companyId));
    }

    @PostMapping
    @PreAuthorize("@perm.has(authentication, 'users:write')")
    public ResponseEntity<?> createUser(Authentication authentication, @RequestBody CreateUserRequest request) {
        String companyId = authUtils.getCompanyId(authentication);

        PlanEnforcementResult check = billingService.canAddUser(companyId);
        if (!check.isAllowed()) {
            return ResponseEntity.status(403).body(java.util.Map.of(
                    "error", "plan_limit_exceeded",
                    "message", check.getReason(),
                    "current", check.getCurrent(),
                    "max", check.getMax()
            ));
        }

        return ResponseEntity.ok(userService.createUser(companyId, request));
    }

    @PutMapping("/{id}")
    @PreAuthorize("@perm.has(authentication, 'users:write')")
    public ResponseEntity<User> updateUser(Authentication authentication, @PathVariable String id, @RequestBody UpdateUserRequest request) {
        String companyId = authUtils.getCompanyId(authentication);
        return ResponseEntity.ok(userService.updateUser(id, companyId, request));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("@perm.has(authentication, 'users:delete')")
    public ResponseEntity<?> deleteUser(Authentication authentication, @PathVariable String id) {
        String companyId = authUtils.getCompanyId(authentication);
        userService.deleteUser(id, companyId);
        return ResponseEntity.ok().body(java.util.Map.of("message", "User deactivated"));
    }
}
