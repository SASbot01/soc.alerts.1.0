package com.blackwolf.backend.repository;

import com.blackwolf.backend.model.HuntResult;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface HuntResultRepository extends JpaRepository<HuntResult, String> {

    List<HuntResult> findByHuntIdOrderByExecutedAtDesc(String huntId);

    List<HuntResult> findByCompanyIdOrderByExecutedAtDesc(String companyId);
}
