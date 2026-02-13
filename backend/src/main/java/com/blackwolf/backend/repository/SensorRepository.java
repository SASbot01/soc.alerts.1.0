package com.blackwolf.backend.repository;

import com.blackwolf.backend.model.Sensor;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface SensorRepository extends JpaRepository<Sensor, String> {
    List<Sensor> findByCompanyId(String companyId);
    List<Sensor> findByIsTemplateTrue();
    Optional<Sensor> findByCompanyIdAndSourceTemplateId(String companyId, String sourceTemplateId);
    List<Sensor> findByCompanyIdAndIsTemplateFalseOrIsTemplateIsNull(String companyId);
}
