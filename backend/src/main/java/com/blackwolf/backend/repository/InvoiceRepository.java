package com.blackwolf.backend.repository;

import com.blackwolf.backend.model.Invoice;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface InvoiceRepository extends JpaRepository<Invoice, String> {
    List<Invoice> findByCompanyIdOrderByCreatedAtDesc(String companyId);
    Optional<Invoice> findByStripeInvoiceId(String stripeInvoiceId);
}
