-- Email drip sequence jobs for automated onboarding emails
CREATE TABLE email_sequence_jobs (
    id VARCHAR(36) PRIMARY KEY,
    company_id VARCHAR(36) NOT NULL,
    recipient VARCHAR(255) NOT NULL,
    email_type VARCHAR(50) NOT NULL,
    subject VARCHAR(500),
    scheduled_at DATETIME NOT NULL,
    sent_at DATETIME,
    status VARCHAR(20) DEFAULT 'pending',
    attempts INT DEFAULT 0,
    error_message TEXT,
    metadata JSON,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    INDEX idx_email_jobs_status_schedule (status, scheduled_at),
    INDEX idx_email_jobs_company (company_id)
);
