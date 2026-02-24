package com.blackwolf.backend.service;

import com.blackwolf.backend.dto.BillingDTOs.PlanLimits;
import com.blackwolf.backend.model.BillingEvent;
import com.blackwolf.backend.model.Company;
import com.blackwolf.backend.model.Invoice;
import com.blackwolf.backend.repository.BillingEventRepository;
import com.blackwolf.backend.repository.CompanyRepository;
import com.blackwolf.backend.repository.InvoiceRepository;
import com.stripe.model.Event;
import com.stripe.model.EventDataObjectDeserializer;
import com.stripe.model.StripeObject;
import com.stripe.model.Subscription;
import com.stripe.net.Webhook;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;

@Service
public class StripeWebhookService {

    private static final Logger log = LoggerFactory.getLogger(StripeWebhookService.class);

    @Autowired
    private BillingEventRepository billingEventRepository;

    @Autowired
    private CompanyRepository companyRepository;

    @Autowired
    private InvoiceRepository invoiceRepository;

    @Autowired
    private OnboardingService onboardingService;

    @Value("${stripe.webhook-secret:}")
    private String webhookSecret;

    public void handleWebhook(String payload, String sigHeader) {
        Event event;
        try {
            if (webhookSecret != null && !webhookSecret.isBlank()) {
                event = Webhook.constructEvent(payload, sigHeader, webhookSecret);
            } else {
                event = Event.GSON.fromJson(payload, Event.class);
            }
        } catch (Exception e) {
            log.error("Webhook signature verification failed: {}", e.getMessage());
            throw new RuntimeException("Invalid webhook signature");
        }

        // Idempotency check
        if (billingEventRepository.findByStripeEventId(event.getId()).isPresent()) {
            log.info("Duplicate webhook event ignored: {}", event.getId());
            return;
        }

        String eventType = event.getType();
        log.info("Processing Stripe webhook: {} ({})", eventType, event.getId());

        try {
            switch (eventType) {
                case "checkout.session.completed" -> handleCheckoutCompleted(event);
                case "invoice.payment_succeeded" -> handleInvoicePaid(event);
                case "invoice.payment_failed" -> handleInvoiceFailed(event);
                case "customer.subscription.updated" -> handleSubscriptionUpdated(event);
                case "customer.subscription.deleted" -> handleSubscriptionDeleted(event);
                default -> log.info("Unhandled webhook event type: {}", eventType);
            }
        } catch (Exception e) {
            log.error("Error processing webhook {}: {}", eventType, e.getMessage(), e);
        }

        // Save billing event for audit
        saveBillingEvent(event, payload);
    }

    @Transactional
    private void handleCheckoutCompleted(Event event) {
        EventDataObjectDeserializer deserializer = event.getDataObjectDeserializer();
        if (deserializer.getObject().isEmpty()) return;

        StripeObject obj = deserializer.getObject().get();
        if (!(obj instanceof com.stripe.model.checkout.Session session)) return;

        // --- NEW: Auto-provision from onboarding checkout ---
        String onboardingRequestId = session.getMetadata().get("onboardingRequestId");
        if (onboardingRequestId != null) {
            log.info("Onboarding checkout completed for request: {}", onboardingRequestId);
            try {
                onboardingService.provisionFromWebhook(
                        onboardingRequestId,
                        session.getCustomer(),
                        session.getSubscription());
            } catch (Exception e) {
                log.error("Failed to auto-provision from onboarding {}: {}", onboardingRequestId, e.getMessage(), e);
            }
            return;
        }

        // --- Existing flow for already-provisioned companies ---
        String companyId = session.getMetadata().get("companyId");
        String plan = session.getMetadata().get("plan");

        if (companyId == null) {
            // Try to find by customer ID
            String customerId = session.getCustomer();
            Optional<Company> companyOpt = companyRepository.findByStripeCustomerId(customerId);
            if (companyOpt.isEmpty()) {
                log.warn("No company found for checkout session customer: {}", customerId);
                return;
            }
            companyId = companyOpt.get().getId();
        }

        Company company = companyRepository.findById(companyId).orElse(null);
        if (company == null) {
            log.warn("Company not found for checkout: {}", companyId);
            return;
        }

        String subscriptionId = session.getSubscription();
        company.setStripeSubscriptionId(subscriptionId);
        company.setSubscriptionStatus("active");

        if (plan != null) {
            company.setPlan(plan);
            PlanLimits limits = BillingService.getLimitsForPlan(plan);
            company.setMaxAssets(limits.getMaxAssets());
            company.setMaxUsers(limits.getMaxUsers());
            company.setRetentionDays(limits.getRetentionDays());
        }

        // Sync trial & period from subscription
        try {
            if (subscriptionId != null) {
                Subscription sub = Subscription.retrieve(subscriptionId);
                if (sub.getTrialEnd() != null) {
                    company.setTrialEndsAt(BillingService.fromEpoch(sub.getTrialEnd()));
                }
                if (sub.getCurrentPeriodEnd() != null) {
                    company.setCurrentPeriodEnd(BillingService.fromEpoch(sub.getCurrentPeriodEnd()));
                }
            }
        } catch (Exception e) {
            log.warn("Could not sync subscription details: {}", e.getMessage());
        }

        companyRepository.save(company);
        log.info("Checkout completed for company {}, plan: {}, subscription: {}", companyId, plan, subscriptionId);
    }

    @Transactional
    private void handleInvoicePaid(Event event) {
        EventDataObjectDeserializer deserializer = event.getDataObjectDeserializer();
        if (deserializer.getObject().isEmpty()) return;

        StripeObject obj = deserializer.getObject().get();
        if (!(obj instanceof com.stripe.model.Invoice stripeInvoice)) return;

        upsertInvoice(stripeInvoice);

        // Ensure subscription status is active
        String customerId = stripeInvoice.getCustomer();
        companyRepository.findByStripeCustomerId(customerId).ifPresent(company -> {
            if (!"active".equals(company.getSubscriptionStatus())) {
                company.setSubscriptionStatus("active");
                companyRepository.save(company);
            }
        });

        log.info("Invoice paid: {}", stripeInvoice.getId());
    }

    @Transactional
    private void handleInvoiceFailed(Event event) {
        EventDataObjectDeserializer deserializer = event.getDataObjectDeserializer();
        if (deserializer.getObject().isEmpty()) return;

        StripeObject obj = deserializer.getObject().get();
        if (!(obj instanceof com.stripe.model.Invoice stripeInvoice)) return;

        upsertInvoice(stripeInvoice);

        // Mark subscription as past_due
        String customerId = stripeInvoice.getCustomer();
        companyRepository.findByStripeCustomerId(customerId).ifPresent(company -> {
            company.setSubscriptionStatus("past_due");
            companyRepository.save(company);
        });

        log.warn("Invoice payment failed: {}", stripeInvoice.getId());
    }

    @Transactional
    private void handleSubscriptionUpdated(Event event) {
        EventDataObjectDeserializer deserializer = event.getDataObjectDeserializer();
        if (deserializer.getObject().isEmpty()) return;

        StripeObject obj = deserializer.getObject().get();
        if (!(obj instanceof Subscription sub)) return;

        String customerId = sub.getCustomer();
        companyRepository.findByStripeCustomerId(customerId).ifPresent(company -> {
            company.setSubscriptionStatus(sub.getStatus());
            if (sub.getCurrentPeriodEnd() != null) {
                company.setCurrentPeriodEnd(BillingService.fromEpoch(sub.getCurrentPeriodEnd()));
            }
            if (sub.getTrialEnd() != null) {
                company.setTrialEndsAt(BillingService.fromEpoch(sub.getTrialEnd()));
            }
            if (Boolean.TRUE.equals(sub.getCancelAtPeriodEnd())) {
                company.setSubscriptionStatus("canceling");
            }

            // Sync plan from price
            if (!sub.getItems().getData().isEmpty()) {
                String priceId = sub.getItems().getData().get(0).getPrice().getId();
                String plan = mapPriceToLocal(priceId);
                if (plan != null) {
                    company.setPlan(plan);
                    PlanLimits limits = BillingService.getLimitsForPlan(plan);
                    company.setMaxAssets(limits.getMaxAssets());
                    company.setMaxUsers(limits.getMaxUsers());
                    company.setRetentionDays(limits.getRetentionDays());
                }
            }

            companyRepository.save(company);
            log.info("Subscription updated for company {}: status={}", company.getId(), sub.getStatus());
        });
    }

    @Transactional
    private void handleSubscriptionDeleted(Event event) {
        EventDataObjectDeserializer deserializer = event.getDataObjectDeserializer();
        if (deserializer.getObject().isEmpty()) return;

        StripeObject obj = deserializer.getObject().get();
        if (!(obj instanceof Subscription sub)) return;

        String customerId = sub.getCustomer();
        companyRepository.findByStripeCustomerId(customerId).ifPresent(company -> {
            company.setSubscriptionStatus("canceled");
            company.setStripeSubscriptionId(null);

            // Reset to starter limits
            PlanLimits starterLimits = BillingService.getLimitsForPlan("starter");
            company.setPlan("starter");
            company.setMaxAssets(starterLimits.getMaxAssets());
            company.setMaxUsers(starterLimits.getMaxUsers());
            company.setRetentionDays(starterLimits.getRetentionDays());

            companyRepository.save(company);
            log.info("Subscription deleted for company {}, reset to starter", company.getId());
        });
    }

    // =====================
    // Helpers
    // =====================

    private void upsertInvoice(com.stripe.model.Invoice stripeInvoice) {
        String customerId = stripeInvoice.getCustomer();
        Optional<Company> companyOpt = companyRepository.findByStripeCustomerId(customerId);
        if (companyOpt.isEmpty()) return;

        String companyId = companyOpt.get().getId();

        Invoice invoice = invoiceRepository.findByStripeInvoiceId(stripeInvoice.getId())
                .orElseGet(() -> {
                    Invoice inv = new Invoice();
                    inv.setId(UUID.randomUUID().toString());
                    inv.setCompanyId(companyId);
                    inv.setStripeInvoiceId(stripeInvoice.getId());
                    inv.setCreatedAt(LocalDateTime.now());
                    return inv;
                });

        invoice.setAmountDue(stripeInvoice.getAmountDue());
        invoice.setAmountPaid(stripeInvoice.getAmountPaid());
        invoice.setCurrency(stripeInvoice.getCurrency());
        invoice.setStatus(stripeInvoice.getStatus());
        invoice.setInvoiceUrl(stripeInvoice.getHostedInvoiceUrl());
        invoice.setInvoicePdf(stripeInvoice.getInvoicePdf());

        if (stripeInvoice.getPeriodStart() != null) {
            invoice.setPeriodStart(BillingService.fromEpoch(stripeInvoice.getPeriodStart()));
        }
        if (stripeInvoice.getPeriodEnd() != null) {
            invoice.setPeriodEnd(BillingService.fromEpoch(stripeInvoice.getPeriodEnd()));
        }

        invoiceRepository.save(invoice);
    }

    private void saveBillingEvent(Event event, String payload) {
        try {
            String companyId = null;
            // Try to extract company from event metadata
            EventDataObjectDeserializer deserializer = event.getDataObjectDeserializer();
            if (deserializer.getObject().isPresent()) {
                StripeObject obj = deserializer.getObject().get();
                if (obj instanceof com.stripe.model.checkout.Session session) {
                    companyId = session.getMetadata().get("companyId");
                    if (companyId == null && session.getCustomer() != null) {
                        companyRepository.findByStripeCustomerId(session.getCustomer())
                                .ifPresent(c -> {});
                    }
                }
            }

            BillingEvent be = new BillingEvent();
            be.setId(UUID.randomUUID().toString());
            be.setCompanyId(companyId);
            be.setStripeEventId(event.getId());
            be.setEventType(event.getType());
            be.setPayload(payload);
            be.setProcessedAt(LocalDateTime.now());
            billingEventRepository.save(be);
        } catch (Exception e) {
            log.warn("Failed to save billing event: {}", e.getMessage());
        }
    }

    @Value("${stripe.prices.starter:}")
    private String starterPrice;

    @Value("${stripe.prices.professional:}")
    private String proPrice;

    @Value("${stripe.prices.enterprise:}")
    private String entPrice;

    private String mapPriceToLocal(String priceId) {
        if (priceId == null) return null;
        if (priceId.equals(starterPrice)) return "starter";
        if (priceId.equals(proPrice)) return "professional";
        if (priceId.equals(entPrice)) return "enterprise";
        return null;
    }
}
