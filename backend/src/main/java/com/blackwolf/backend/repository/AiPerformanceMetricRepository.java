package com.blackwolf.backend.repository;

import com.blackwolf.backend.model.AiPerformanceMetric;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface AiPerformanceMetricRepository extends JpaRepository<AiPerformanceMetric, String> {

    Optional<AiPerformanceMetric> findByCompanyIdAndMetricDate(String companyId, LocalDate date);

    List<AiPerformanceMetric> findByCompanyIdAndMetricDateBetweenOrderByMetricDateAsc(
            String companyId, LocalDate from, LocalDate to);

    List<AiPerformanceMetric> findByCompanyIdIsNullAndMetricDateBetweenOrderByMetricDateAsc(
            LocalDate from, LocalDate to);
}
