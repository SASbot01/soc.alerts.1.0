package com.blackwolf.backend.service;

import com.blackwolf.backend.model.MarketplaceInstallation;
import com.blackwolf.backend.model.MarketplaceItem;
import com.blackwolf.backend.repository.MarketplaceInstallationRepository;
import com.blackwolf.backend.repository.MarketplaceItemRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class MarketplaceService {

    private static final Logger log = LoggerFactory.getLogger(MarketplaceService.class);

    @Autowired
    private MarketplaceItemRepository itemRepository;

    @Autowired
    private MarketplaceInstallationRepository installationRepository;

    // ===== Item Listing =====

    public List<MarketplaceItem> listItems(String type, String category) {
        if (type != null && !type.isBlank()) {
            return itemRepository.findByItemTypeAndIsActiveTrue(type);
        }
        if (category != null && !category.isBlank()) {
            return itemRepository.findByCategoryAndIsActiveTrue(category);
        }
        return itemRepository.findByIsActiveTrueOrderByDownloadsDesc();
    }

    public MarketplaceItem getItem(String id) {
        return itemRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Marketplace item not found: " + id));
    }

    // ===== Install / Uninstall =====

    public MarketplaceInstallation install(String companyId, String itemId, String userId) {
        MarketplaceItem item = getItem(itemId);

        // Check if already installed
        installationRepository.findByCompanyIdAndItemId(companyId, itemId).ifPresent(existing -> {
            if (existing.isActive()) {
                throw new RuntimeException("Item already installed for this company");
            }
        });

        // Create installation record
        MarketplaceInstallation installation = new MarketplaceInstallation();
        installation.setCompanyId(companyId);
        installation.setItemId(itemId);
        installation.setInstalledVersion(item.getVersion());
        installation.setInstalledBy(userId);

        // Increment downloads counter
        item.setDownloads(item.getDownloads() + 1);
        itemRepository.save(item);

        log.info("Marketplace item '{}' installed by user {} for company {}", item.getTitle(), userId, companyId);
        return installationRepository.save(installation);
    }

    public void uninstall(String companyId, String itemId, String userId) {
        MarketplaceInstallation installation = installationRepository.findByCompanyIdAndItemId(companyId, itemId)
                .orElseThrow(() -> new RuntimeException("Installation not found"));

        if (!installation.getCompanyId().equals(companyId)) {
            throw new RuntimeException("Access denied");
        }

        installation.setActive(false);
        installationRepository.save(installation);

        log.info("Marketplace item {} uninstalled by user {} for company {}", itemId, userId, companyId);
    }

    // ===== Rating =====

    public MarketplaceItem rateItem(String itemId, double rating) {
        if (rating < 1 || rating > 5) {
            throw new RuntimeException("Rating must be between 1 and 5");
        }

        MarketplaceItem item = getItem(itemId);

        // Recalculate average rating
        double totalRating = item.getRating() * item.getRatingCount();
        int newCount = item.getRatingCount() + 1;
        double newAverage = (totalRating + rating) / newCount;

        item.setRating(Math.round(newAverage * 100.0) / 100.0);
        item.setRatingCount(newCount);

        return itemRepository.save(item);
    }

    // ===== Installed Items =====

    public List<MarketplaceInstallation> getInstalled(String companyId) {
        return installationRepository.findByCompanyId(companyId);
    }
}
