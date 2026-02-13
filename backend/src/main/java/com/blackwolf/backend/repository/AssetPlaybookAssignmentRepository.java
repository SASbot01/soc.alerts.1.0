package com.blackwolf.backend.repository;

import com.blackwolf.backend.model.AssetPlaybookAssignment;
import com.blackwolf.backend.model.AssetPlaybookAssignmentId;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface AssetPlaybookAssignmentRepository extends JpaRepository<AssetPlaybookAssignment, AssetPlaybookAssignmentId> {
    List<AssetPlaybookAssignment> findByAssetId(String assetId);
    List<AssetPlaybookAssignment> findByPlaybookId(String playbookId);
    List<AssetPlaybookAssignment> findByAssetIdAndIsActiveTrue(String assetId);
    void deleteByAssetIdAndPlaybookId(String assetId, String playbookId);
}
