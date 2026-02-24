-- V17: Stripe Billing support
-- Adds billing columns to companies + billing_events and invoices tables

-- New billing columns on companies
ALTER TABLE companies
    ADD COLUMN stripe_customer_id VARCHAR(255),
    ADD COLUMN stripe_subscription_id VARCHAR(255),
    ADD COLUMN subscription_status VARCHAR(50) DEFAULT 'none',
    ADD COLUMN trial_ends_at DATETIME,
    ADD COLUMN current_period_end DATETIME,
    ADD COLUMN max_assets INT DEFAULT 50,
    ADD COLUMN max_users INT DEFAULT 5,
    ADD COLUMN retention_days INT DEFAULT 30;

-- Audit log for Stripe webhook events (idempotency)
CREATE TABLE billing_events (
    id VARCHAR(36) PRIMARY KEY,
    company_id VARCHAR(36),
    stripe_event_id VARCHAR(255) NOT NULL UNIQUE,
    event_type VARCHAR(100) NOT NULL,
    payload JSON,
    processed_at DATETIME NOT NULL,
    FOREIGN KEY (company_id) REFERENCES companies(id)
);

-- Local cache of Stripe invoices
CREATE TABLE invoices (
    id VARCHAR(36) PRIMARY KEY,
    company_id VARCHAR(36) NOT NULL,
    stripe_invoice_id VARCHAR(255) NOT NULL UNIQUE,
    amount_due BIGINT DEFAULT 0,
    amount_paid BIGINT DEFAULT 0,
    currency VARCHAR(10) DEFAULT 'usd',
    status VARCHAR(50),
    invoice_url TEXT,
    invoice_pdf TEXT,
    period_start DATETIME,
    period_end DATETIME,
    created_at DATETIME NOT NULL,
    FOREIGN KEY (company_id) REFERENCES companies(id)
);

-- Set limits based on existing plans
UPDATE companies SET max_assets = 50,  max_users = 5,      retention_days = 30  WHERE plan IN ('starter', 'standard', 'basic');
UPDATE companies SET max_assets = 200, max_users = 15,     retention_days = 90  WHERE plan = 'premium';
UPDATE companies SET max_assets = 500, max_users = 999999, retention_days = 365 WHERE plan = 'enterprise';
