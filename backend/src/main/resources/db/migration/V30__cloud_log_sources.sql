-- V30: Cloud log ingestion sources

CREATE TABLE cloud_log_sources (
    id VARCHAR(36) PRIMARY KEY,
    company_id VARCHAR(36) NOT NULL,
    provider VARCHAR(30) NOT NULL COMMENT 'aws, azure, gcp',
    source_type VARCHAR(50) NOT NULL COMMENT 'cloudtrail, activity_log, audit_log',
    name VARCHAR(200) NOT NULL,
    config JSON NOT NULL COMMENT 'Credentials and config (encrypted)',
    is_active BOOLEAN DEFAULT TRUE,
    last_poll_at DATETIME NULL,
    events_ingested BIGINT DEFAULT 0,
    last_error TEXT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    INDEX idx_cloud_company (company_id),
    INDEX idx_cloud_provider (provider)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
