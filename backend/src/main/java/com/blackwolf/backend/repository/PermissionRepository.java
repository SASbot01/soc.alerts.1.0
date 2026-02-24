package com.blackwolf.backend.repository;

import com.blackwolf.backend.model.Permission;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PermissionRepository extends JpaRepository<Permission, String> {
    List<Permission> findByResource(String resource);
}
