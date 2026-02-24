package com.blackwolf.backend.repository;

import com.blackwolf.backend.model.Role;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface RoleRepository extends JpaRepository<Role, String> {
    Optional<Role> findByNameAndCompanyId(String name, String companyId);

    Optional<Role> findByNameAndIsSystemTrue(String name);

    List<Role> findByCompanyIdOrIsSystemTrue(String companyId);

    List<Role> findByIsSystemTrue();
}
