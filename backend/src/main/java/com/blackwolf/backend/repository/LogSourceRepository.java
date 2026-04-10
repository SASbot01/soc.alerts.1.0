package com.blackwolf.backend.repository;

import com.blackwolf.backend.model.LogSource;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface LogSourceRepository extends JpaRepository<LogSource, Long> {

    List<LogSource> findByCompanyIdOrderByLastEventAtDesc(String companyId);

    List<LogSource> findByCompanyIdAndEnabled(String companyId, Boolean enabled);
}
