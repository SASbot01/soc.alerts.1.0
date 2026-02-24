package com.blackwolf.backend.model;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "invoices")
public class Invoice {
    @Id
    private String id;

    private String companyId;

    @Column(unique = true, nullable = false)
    private String stripeInvoiceId;

    private Long amountDue;
    private Long amountPaid;
    private String currency;
    private String status;

    @Column(columnDefinition = "TEXT")
    private String invoiceUrl;

    @Column(columnDefinition = "TEXT")
    private String invoicePdf;

    private LocalDateTime periodStart;
    private LocalDateTime periodEnd;
    private LocalDateTime createdAt;
}
