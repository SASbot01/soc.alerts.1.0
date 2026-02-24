package com.blackwolf.backend.security;

import com.blackwolf.backend.model.User;
import com.blackwolf.backend.repository.UserRepository;
import com.blackwolf.backend.service.RbacService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;

@Service
public class CustomUserDetailsService implements UserDetailsService {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private RbacService rbacService;

    @Override
    public UserDetails loadUserByUsername(String id) throws UsernameNotFoundException {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new UsernameNotFoundException("User not found with id: " + id));

        List<GrantedAuthority> authorities = new ArrayList<>();

        // Add role authority (ROLE_ADMIN, ROLE_ANALYST, etc.)
        authorities.add(new SimpleGrantedAuthority("ROLE_" + user.getRole().toUpperCase()));

        // Load granular permissions from RBAC
        Set<String> permissions = rbacService.getPermissionsForRole(user.getRole(), user.getCompanyId());
        for (String permission : permissions) {
            authorities.add(new SimpleGrantedAuthority(permission));
        }

        return new org.springframework.security.core.userdetails.User(
                user.getId(),
                user.getPassword(),
                authorities);
    }
}
