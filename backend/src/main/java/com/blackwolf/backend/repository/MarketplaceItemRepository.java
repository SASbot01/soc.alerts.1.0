package com.blackwolf.backend.repository;

import com.blackwolf.backend.model.MarketplaceItem;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface MarketplaceItemRepository extends JpaRepository<MarketplaceItem, String> {
    List<MarketplaceItem> findByIsActiveTrueOrderByDownloadsDesc();
    List<MarketplaceItem> findByItemTypeAndIsActiveTrue(String itemType);
    List<MarketplaceItem> findByCategoryAndIsActiveTrue(String category);
}
