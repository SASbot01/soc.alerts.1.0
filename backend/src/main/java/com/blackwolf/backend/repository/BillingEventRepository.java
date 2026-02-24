package com.blackwolf.backend.repository;

import com.blackwolf.backend.model.BillingEvent;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface BillingEventRepository extends JpaRepository<BillingEvent, String> {
    Optional<BillingEvent> findByStripeEventId(String stripeEventId);
}
