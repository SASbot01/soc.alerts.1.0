-- Prospect tracking for sales outreach bot
CREATE TABLE IF NOT EXISTS prospects (
    id VARCHAR(36) PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    company_name VARCHAR(255),
    domain VARCHAR(255),
    contact_name VARCHAR(255),
    source VARCHAR(50) NOT NULL DEFAULT 'manual',  -- manual, scrape, referral, inbound
    status VARCHAR(30) NOT NULL DEFAULT 'new',       -- new, contacted, engaged, converted, unsubscribed, bounced
    sequence_step INT NOT NULL DEFAULT 0,             -- 0=not started, 1=intro, 2=value, 3=social_proof, 4=urgency
    last_email_at DATETIME NULL,
    next_email_at DATETIME NULL,
    opens INT NOT NULL DEFAULT 0,
    clicks INT NOT NULL DEFAULT 0,
    replies INT NOT NULL DEFAULT 0,
    score DOUBLE NOT NULL DEFAULT 0,                  -- engagement score 0-100
    tags VARCHAR(500),                                 -- comma-separated tags
    notes TEXT,
    converted_company_id VARCHAR(36) NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_prospects_status (status),
    INDEX idx_prospects_next_email (next_email_at),
    INDEX idx_prospects_source (source),
    INDEX idx_prospects_score (score)
);

-- Outreach log: every email sent
CREATE TABLE IF NOT EXISTS outreach_log (
    id VARCHAR(36) PRIMARY KEY,
    prospect_id VARCHAR(36) NOT NULL,
    email_type VARCHAR(50) NOT NULL,   -- outreach_intro, outreach_value, outreach_social_proof, outreach_urgency
    subject VARCHAR(500),
    status VARCHAR(20) NOT NULL DEFAULT 'sent',  -- sent, delivered, opened, clicked, bounced, failed
    sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    opened_at DATETIME NULL,
    clicked_at DATETIME NULL,
    error_message TEXT,
    INDEX idx_outreach_prospect (prospect_id),
    INDEX idx_outreach_type (email_type),
    INDEX idx_outreach_sent (sent_at),
    FOREIGN KEY (prospect_id) REFERENCES prospects(id) ON DELETE CASCADE
);

-- Bot performance metrics (daily aggregation)
CREATE TABLE IF NOT EXISTS outreach_metrics (
    id VARCHAR(36) PRIMARY KEY,
    metric_date DATE NOT NULL,
    emails_sent INT NOT NULL DEFAULT 0,
    emails_opened INT NOT NULL DEFAULT 0,
    emails_clicked INT NOT NULL DEFAULT 0,
    emails_bounced INT NOT NULL DEFAULT 0,
    replies_received INT NOT NULL DEFAULT 0,
    conversions INT NOT NULL DEFAULT 0,
    open_rate DOUBLE,
    click_rate DOUBLE,
    conversion_rate DOUBLE,
    best_performing_template VARCHAR(50),
    best_send_hour INT,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE INDEX idx_outreach_metrics_date (metric_date)
);
