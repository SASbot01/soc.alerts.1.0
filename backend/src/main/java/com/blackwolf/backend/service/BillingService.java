package com.blackwolf.backend.service;

import com.blackwolf.backend.dto.BillingDTOs.*;
import com.blackwolf.backend.model.Company;
import com.blackwolf.backend.model.Invoice;
import com.blackwolf.backend.repository.AssetRepository;
import com.blackwolf.backend.repository.CompanyRepository;
import com.blackwolf.backend.repository.InvoiceRepository;
import com.blackwolf.backend.repository.UserRepository;
import com.stripe.model.Customer;
import com.stripe.model.Subscription;
import com.stripe.param.CustomerCreateParams;
import com.stripe.param.SubscriptionUpdateParams;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class BillingService {

    private static final Logger log = LoggerFactory.getLogger(BillingService.class);

    @Autowired
    private CompanyRepository companyRepository;

    @Autowired
    private InvoiceRepository invoiceRepository;

    @Autowired
    private AssetRepository assetRepository;

    @Autowired
    private UserRepository userRepository;

    @Value("${stripe.prices.starter:}")
    private String starterPriceId;

    @Value("${stripe.prices.professional:}")
    private String professionalPriceId;

    @Value("${stripe.prices.enterprise:}")
    private String enterprisePriceId;

    // =====================
    // Stripe Customer
    // =====================

    public String createStripeCustomer(Company company) {
        try {
            CustomerCreateParams params = CustomerCreateParams.builder()
                    .setEmail(company.getContactEmail())
                    .setName(company.getCompanyName())
                    .putMetadata("companyId", company.getId())
                    .build();

            Customer customer = Customer.create(params);
            company.setStripeCustomerId(customer.getId());
            companyRepository.save(company);

            log.info("Stripe customer created: {} for company {}", customer.getId(), company.getId());
            return customer.getId();
        } catch (Exception e) {
            log.error("Failed to create Stripe customer for company {}: {}", company.getId(), e.getMessage());
            return null;
        }
    }

    // =====================
    // Checkout Session
    // =====================

    public CheckoutResponse createCheckoutSession(String companyId, String plan) {
        Company company = companyRepository.findById(companyId)
                .orElseThrow(() -> new RuntimeException("Company not found"));

        String priceId = getPriceId(plan);
        if (priceId == null || priceId.isBlank()) {
            throw new RuntimeException("Price not configured for plan: " + plan);
        }

        // Create Stripe customer if needed
        if (company.getStripeCustomerId() == null || company.getStripeCustomerId().isBlank()) {
            createStripeCustomer(company);
        }

        try {
            com.stripe.param.checkout.SessionCreateParams params = com.stripe.param.checkout.SessionCreateParams.builder()
                    .setCustomer(company.getStripeCustomerId())
                    .setMode(com.stripe.param.checkout.SessionCreateParams.Mode.SUBSCRIPTION)
                    .addLineItem(com.stripe.param.checkout.SessionCreateParams.LineItem.builder()
                            .setPrice(priceId)
                            .setQuantity(1L)
                            .build())
                    .setSubscriptionData(com.stripe.param.checkout.SessionCreateParams.SubscriptionData.builder()
                            .setTrialPeriodDays(14L)
                            .build())
                    .setSuccessUrl("https://soc.blackwolfsec.io/billing?session_id={CHECKOUT_SESSION_ID}")
                    .setCancelUrl("https://soc.blackwolfsec.io/billing")
                    .putMetadata("companyId", companyId)
                    .putMetadata("plan", plan)
                    .build();

            com.stripe.model.checkout.Session session = com.stripe.model.checkout.Session.create(params);

            CheckoutResponse response = new CheckoutResponse();
            response.setSessionId(session.getId());
            response.setUrl(session.getUrl());
            return response;
        } catch (Exception e) {
            log.error("Failed to create checkout session for company {}: {}", companyId, e.getMessage());
            throw new RuntimeException("Failed to create checkout session: " + e.getMessage());
        }
    }

    // =====================
    // Onboarding Checkout (no card required)
    // =====================

    public CheckoutResponse createOnboardingCheckoutSession(String onboardingRequestId, String contactEmail,
                                                             String companyName, String plan) {
        String priceId = getPriceId(plan != null ? plan : "starter");
        if (priceId == null || priceId.isBlank()) {
            priceId = getPriceId("starter");
        }
        if (priceId == null || priceId.isBlank()) {
            throw new RuntimeException("No Stripe price configured for plan: " + plan);
        }

        try {
            // Create ephemeral Stripe customer for the prospect
            CustomerCreateParams custParams = CustomerCreateParams.builder()
                    .setEmail(contactEmail)
                    .setName(companyName)
                    .putMetadata("onboardingRequestId", onboardingRequestId)
                    .build();
            Customer customer = Customer.create(custParams);

            com.stripe.param.checkout.SessionCreateParams params = com.stripe.param.checkout.SessionCreateParams.builder()
                    .setCustomer(customer.getId())
                    .setMode(com.stripe.param.checkout.SessionCreateParams.Mode.SUBSCRIPTION)
                    .setPaymentMethodCollection(
                            com.stripe.param.checkout.SessionCreateParams.PaymentMethodCollection.IF_REQUIRED)
                    .addLineItem(com.stripe.param.checkout.SessionCreateParams.LineItem.builder()
                            .setPrice(priceId)
                            .setQuantity(1L)
                            .build())
                    .setSubscriptionData(com.stripe.param.checkout.SessionCreateParams.SubscriptionData.builder()
                            .setTrialPeriodDays(14L)
                            .build())
                    .setSuccessUrl("https://soc.blackwolfsec.io/login?provisioned=true")
                    .setCancelUrl("https://soc.blackwolfsec.io/landing")
                    .putMetadata("onboardingRequestId", onboardingRequestId)
                    .putMetadata("plan", plan != null ? plan : "starter")
                    .build();

            com.stripe.model.checkout.Session session = com.stripe.model.checkout.Session.create(params);

            log.info("Onboarding checkout session created for {} (request: {})", contactEmail, onboardingRequestId);

            CheckoutResponse response = new CheckoutResponse();
            response.setSessionId(session.getId());
            response.setUrl(session.getUrl());
            return response;
        } catch (Exception e) {
            log.error("Failed to create onboarding checkout for {}: {}", contactEmail, e.getMessage());
            throw new RuntimeException("Failed to create checkout session: " + e.getMessage());
        }
    }

    // =====================
    // Change Plan
    // =====================

    @Transactional
    public void changePlan(String companyId, String newPlan) {
        Company company = companyRepository.findById(companyId)
                .orElseThrow(() -> new RuntimeException("Company not found"));

        if (company.getStripeSubscriptionId() == null) {
            throw new RuntimeException("No active subscription to change");
        }

        String newPriceId = getPriceId(newPlan);
        if (newPriceId == null || newPriceId.isBlank()) {
            throw new RuntimeException("Price not configured for plan: " + newPlan);
        }

        try {
            Subscription subscription = Subscription.retrieve(company.getStripeSubscriptionId());
            String itemId = subscription.getItems().getData().get(0).getId();

            SubscriptionUpdateParams params = SubscriptionUpdateParams.builder()
                    .addItem(SubscriptionUpdateParams.Item.builder()
                            .setId(itemId)
                            .setPrice(newPriceId)
                            .build())
                    .setProrationBehavior(SubscriptionUpdateParams.ProrationBehavior.CREATE_PRORATIONS)
                    .build();

            subscription.update(params);

            // Update local plan info
            company.setPlan(newPlan);
            PlanLimits limits = getLimitsForPlan(newPlan);
            company.setMaxAssets(limits.getMaxAssets());
            company.setMaxUsers(limits.getMaxUsers());
            company.setRetentionDays(limits.getRetentionDays());
            companyRepository.save(company);

            log.info("Plan changed to {} for company {}", newPlan, companyId);
        } catch (Exception e) {
            log.error("Failed to change plan for company {}: {}", companyId, e.getMessage());
            throw new RuntimeException("Failed to change plan: " + e.getMessage());
        }
    }

    // =====================
    // Cancel Subscription
    // =====================

    @Transactional
    public void cancelSubscription(String companyId) {
        Company company = companyRepository.findById(companyId)
                .orElseThrow(() -> new RuntimeException("Company not found"));

        if (company.getStripeSubscriptionId() == null) {
            throw new RuntimeException("No active subscription to cancel");
        }

        try {
            Subscription subscription = Subscription.retrieve(company.getStripeSubscriptionId());
            SubscriptionUpdateParams params = SubscriptionUpdateParams.builder()
                    .setCancelAtPeriodEnd(true)
                    .build();
            subscription.update(params);

            company.setSubscriptionStatus("canceling");
            companyRepository.save(company);

            log.info("Subscription canceled (end of period) for company {}", companyId);
        } catch (Exception e) {
            log.error("Failed to cancel subscription for company {}: {}", companyId, e.getMessage());
            throw new RuntimeException("Failed to cancel subscription: " + e.getMessage());
        }
    }

    // =====================
    // Reactivate Subscription
    // =====================

    @Transactional
    public void reactivateSubscription(String companyId) {
        Company company = companyRepository.findById(companyId)
                .orElseThrow(() -> new RuntimeException("Company not found"));

        if (company.getStripeSubscriptionId() == null) {
            throw new RuntimeException("No subscription to reactivate");
        }

        try {
            Subscription subscription = Subscription.retrieve(company.getStripeSubscriptionId());
            SubscriptionUpdateParams params = SubscriptionUpdateParams.builder()
                    .setCancelAtPeriodEnd(false)
                    .build();
            subscription.update(params);

            company.setSubscriptionStatus("active");
            companyRepository.save(company);

            log.info("Subscription reactivated for company {}", companyId);
        } catch (Exception e) {
            log.error("Failed to reactivate subscription for company {}: {}", companyId, e.getMessage());
            throw new RuntimeException("Failed to reactivate subscription: " + e.getMessage());
        }
    }

    // =====================
    // Customer Portal
    // =====================

    public PortalResponse createPortalSession(String companyId) {
        Company company = companyRepository.findById(companyId)
                .orElseThrow(() -> new RuntimeException("Company not found"));

        if (company.getStripeCustomerId() == null) {
            throw new RuntimeException("No Stripe customer linked");
        }

        try {
            com.stripe.param.billingportal.SessionCreateParams params = com.stripe.param.billingportal.SessionCreateParams.builder()
                    .setCustomer(company.getStripeCustomerId())
                    .setReturnUrl("https://soc.blackwolfsec.io/billing")
                    .build();

            com.stripe.model.billingportal.Session session = com.stripe.model.billingportal.Session.create(params);

            PortalResponse response = new PortalResponse();
            response.setUrl(session.getUrl());
            return response;
        } catch (Exception e) {
            log.error("Failed to create portal session for company {}: {}", companyId, e.getMessage());
            throw new RuntimeException("Failed to create portal session: " + e.getMessage());
        }
    }

    // =====================
    // Billing Overview
    // =====================

    public BillingOverview getBillingOverview(String companyId) {
        Company company = companyRepository.findById(companyId)
                .orElseThrow(() -> new RuntimeException("Company not found"));

        BillingOverview overview = new BillingOverview();
        overview.setPlan(company.getPlan());
        overview.setSubscriptionStatus(company.getSubscriptionStatus() != null ? company.getSubscriptionStatus() : "none");
        overview.setTrialEndsAt(company.getTrialEndsAt());
        overview.setCurrentPeriodEnd(company.getCurrentPeriodEnd());
        overview.setLimits(getLimitsForPlan(company.getPlan()));

        // Usage
        UsageInfo usage = new UsageInfo();
        usage.setCurrentAssets(assetRepository.findByCompanyId(companyId).size());
        usage.setCurrentUsers(userRepository.findByCompanyId(companyId).size());
        overview.setUsage(usage);

        // Recent invoices
        List<Invoice> invoices = invoiceRepository.findByCompanyIdOrderByCreatedAtDesc(companyId);
        List<InvoiceSummary> summaries = invoices.stream().map(inv -> {
            InvoiceSummary s = new InvoiceSummary();
            s.setId(inv.getId());
            s.setAmountDue(inv.getAmountDue());
            s.setAmountPaid(inv.getAmountPaid());
            s.setCurrency(inv.getCurrency());
            s.setStatus(inv.getStatus());
            s.setInvoiceUrl(inv.getInvoiceUrl());
            s.setInvoicePdf(inv.getInvoicePdf());
            s.setPeriodStart(inv.getPeriodStart());
            s.setPeriodEnd(inv.getPeriodEnd());
            s.setCreatedAt(inv.getCreatedAt());
            return s;
        }).collect(Collectors.toList());
        overview.setRecentInvoices(summaries);

        return overview;
    }

    // =====================
    // Plan Enforcement
    // =====================

    public PlanEnforcementResult canAddAsset(String companyId) {
        Company company = companyRepository.findById(companyId)
                .orElseThrow(() -> new RuntimeException("Company not found"));

        int current = assetRepository.findByCompanyId(companyId).size();
        int max = company.getMaxAssets() != null ? company.getMaxAssets() : 50;

        PlanEnforcementResult result = new PlanEnforcementResult();
        result.setCurrent(current);
        result.setMax(max);
        result.setAllowed(current < max);
        if (!result.isAllowed()) {
            result.setReason("Asset limit reached (" + current + "/" + max + "). Upgrade your plan for more assets.");
        }
        return result;
    }

    public PlanEnforcementResult canAddUser(String companyId) {
        Company company = companyRepository.findById(companyId)
                .orElseThrow(() -> new RuntimeException("Company not found"));

        int current = userRepository.findByCompanyId(companyId).size();
        int max = company.getMaxUsers() != null ? company.getMaxUsers() : 5;

        PlanEnforcementResult result = new PlanEnforcementResult();
        result.setCurrent(current);
        result.setMax(max);
        result.setAllowed(current < max);
        if (!result.isAllowed()) {
            result.setReason("User limit reached (" + current + "/" + max + "). Upgrade your plan for more users.");
        }
        return result;
    }

    // =====================
    // Plans catalog
    // =====================

    public List<PlanInfo> getPlans() {
        List<PlanInfo> plans = new ArrayList<>();

        PlanInfo starter = new PlanInfo();
        starter.setPlanId("starter");
        starter.setName("Starter");
        starter.setPriceMonthly(199900);
        starter.setMaxAssets(50);
        starter.setMaxUsers(5);
        starter.setRetentionDays(30);
        starter.setFeatures(List.of(
                "Up to 50 monitored assets",
                "5 user accounts",
                "30-day data retention",
                "Email & Slack alerts",
                "Basic threat detection"
        ));
        plans.add(starter);

        PlanInfo pro = new PlanInfo();
        pro.setPlanId("professional");
        pro.setName("Professional");
        pro.setPriceMonthly(499900);
        pro.setMaxAssets(200);
        pro.setMaxUsers(15);
        pro.setRetentionDays(90);
        pro.setFeatures(List.of(
                "Up to 200 monitored assets",
                "15 user accounts",
                "90-day data retention",
                "AI-powered autonomous agent",
                "MITRE ATT&CK mapping",
                "Advanced correlation engine"
        ));
        plans.add(pro);

        PlanInfo enterprise = new PlanInfo();
        enterprise.setPlanId("enterprise");
        enterprise.setName("Enterprise");
        enterprise.setPriceMonthly(999900);
        enterprise.setMaxAssets(500);
        enterprise.setMaxUsers(999999);
        enterprise.setRetentionDays(365);
        enterprise.setFeatures(List.of(
                "Up to 500 monitored assets",
                "Unlimited users",
                "365-day data retention",
                "Dedicated support",
                "Custom playbooks",
                "Compliance certifications",
                "Executive PDF reports"
        ));
        plans.add(enterprise);

        return plans;
    }

    // =====================
    // Helpers
    // =====================

    public static PlanLimits getLimitsForPlan(String plan) {
        PlanLimits limits = new PlanLimits();
        switch (plan != null ? plan : "starter") {
            case "professional", "premium" -> {
                limits.setMaxAssets(200);
                limits.setMaxUsers(15);
                limits.setRetentionDays(90);
                limits.setPriceMonthly(499900);
            }
            case "enterprise" -> {
                limits.setMaxAssets(500);
                limits.setMaxUsers(999999);
                limits.setRetentionDays(365);
                limits.setPriceMonthly(999900);
            }
            default -> {
                limits.setMaxAssets(50);
                limits.setMaxUsers(5);
                limits.setRetentionDays(30);
                limits.setPriceMonthly(199900);
            }
        }
        return limits;
    }

    private String getPriceId(String plan) {
        return switch (plan) {
            case "starter" -> starterPriceId;
            case "professional" -> professionalPriceId;
            case "enterprise" -> enterprisePriceId;
            default -> null;
        };
    }

    public static LocalDateTime fromEpoch(Long epoch) {
        if (epoch == null) return null;
        return LocalDateTime.ofInstant(Instant.ofEpochSecond(epoch), ZoneId.systemDefault());
    }
}
