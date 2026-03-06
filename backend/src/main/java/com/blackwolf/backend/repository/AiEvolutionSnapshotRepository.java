package com.blackwolf.backend.repository;

import com.blackwolf.backend.model.AiEvolutionSnapshot;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface AiEvolutionSnapshotRepository extends JpaRepository<AiEvolutionSnapshot, String> {

    List<AiEvolutionSnapshot> findByCompanyIdAndSnapshotDateBetweenOrderBySnapshotDateAsc(
            String companyId, LocalDate from, LocalDate to);

    Optional<AiEvolutionSnapshot> findFirstByCompanyIdAndPeriodTypeOrderBySnapshotDateDesc(
            String companyId, AiEvolutionSnapshot.PeriodType periodType);

    List<AiEvolutionSnapshot> findByCompanyIdOrderBySnapshotDateDesc(String companyId);
}
