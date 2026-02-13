package com.blackwolf.backend.repository;

import com.blackwolf.backend.model.AssetSensorAssignment;
import com.blackwolf.backend.model.AssetSensorAssignmentId;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface AssetSensorAssignmentRepository extends JpaRepository<AssetSensorAssignment, AssetSensorAssignmentId> {
    List<AssetSensorAssignment> findByAssetId(String assetId);
    List<AssetSensorAssignment> findBySensorId(String sensorId);
    List<AssetSensorAssignment> findByAssetIdAndIsActiveTrue(String assetId);
    void deleteByAssetIdAndSensorId(String assetId, String sensorId);
}
