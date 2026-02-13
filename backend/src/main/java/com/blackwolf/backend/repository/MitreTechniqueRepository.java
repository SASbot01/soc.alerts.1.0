package com.blackwolf.backend.repository;

import com.blackwolf.backend.model.MitreTechnique;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface MitreTechniqueRepository extends JpaRepository<MitreTechnique, String> {
    List<MitreTechnique> findByTacticContaining(String tactic);
}
