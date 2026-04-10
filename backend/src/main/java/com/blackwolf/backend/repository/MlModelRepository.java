package com.blackwolf.backend.repository;

import com.blackwolf.backend.model.MlModel;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface MlModelRepository extends JpaRepository<MlModel, Long> {

    List<MlModel> findByCompanyIdOrderByCreatedAtDesc(String companyId);

    List<MlModel> findByCompanyIdAndModelType(String companyId, String modelType);
}
