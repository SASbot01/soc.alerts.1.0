package com.blackwolf.backend.repository;

import com.blackwolf.backend.model.OutreachMetric;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface OutreachMetricRepository extends JpaRepository<OutreachMetric, String> {

    Optional<OutreachMetric> findByMetricDate(LocalDate date);

    List<OutreachMetric> findByMetricDateBetweenOrderByMetricDateAsc(LocalDate from, LocalDate to);
}
