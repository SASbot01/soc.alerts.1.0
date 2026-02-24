package com.blackwolf.backend.repository;

import com.blackwolf.backend.model.SavedHunt;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface SavedHuntRepository extends JpaRepository<SavedHunt, String> {

    List<SavedHunt> findByCompanyIdOrderByUpdatedAtDesc(String companyId);

    List<SavedHunt> findByHuntTypeAndIsActiveTrue(String huntType);

    List<SavedHunt> findByCompanyIdAndHuntType(String companyId, String huntType);
}
