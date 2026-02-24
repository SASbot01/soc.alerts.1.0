package com.blackwolf.backend.repository;

import com.blackwolf.backend.model.Company;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface CompanyRepository extends JpaRepository<Company, String> {
    Optional<Company> findByDomain(String domain);

    Optional<Company> findByApiKey(String apiKey);

    Optional<Company> findByStripeCustomerId(String stripeCustomerId);

    java.util.List<Company> findByRegisteredAtAfter(java.time.LocalDateTime after);
}
