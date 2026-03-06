-- =============================================
-- LDAP Directory, Backup Monitoring & Health Checks
-- =============================================

-- Backup status reports from client agents
CREATE TABLE IF NOT EXISTS backup_statuses (
    id VARCHAR(36) PRIMARY KEY,
    company_id VARCHAR(36) NOT NULL,
    client_host VARCHAR(255) NOT NULL,
    job_name VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL,
    backup_type VARCHAR(50) DEFAULT 'full',
    target VARCHAR(500),
    size_bytes BIGINT DEFAULT 0,
    duration_seconds INT DEFAULT 0,
    error_message TEXT,
    started_at DATETIME,
    finished_at DATETIME,
    reported_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_backup_company (company_id),
    INDEX idx_backup_status (company_id, status),
    INDEX idx_backup_host_job (company_id, client_host, job_name),
    INDEX idx_backup_reported (reported_at)
);

-- Health check definitions per client
CREATE TABLE IF NOT EXISTS health_check_targets (
    id VARCHAR(36) PRIMARY KEY,
    company_id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    check_type VARCHAR(50) NOT NULL,
    target VARCHAR(500) NOT NULL,
    port INT,
    expected_status INT,
    timeout_ms INT DEFAULT 5000,
    interval_seconds INT DEFAULT 300,
    enabled BOOLEAN DEFAULT TRUE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_hc_company (company_id)
);

-- Health check execution results
CREATE TABLE IF NOT EXISTS health_check_results (
    id VARCHAR(36) PRIMARY KEY,
    target_id VARCHAR(36) NOT NULL,
    company_id VARCHAR(36) NOT NULL,
    status VARCHAR(50) NOT NULL,
    response_time_ms INT,
    status_code INT,
    error_message TEXT,
    checked_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_hcr_target (target_id, checked_at),
    INDEX idx_hcr_company (company_id, checked_at),
    INDEX idx_hcr_status (company_id, status)
);

-- LDAP directory sync log (tracks lldap user provisioning)
CREATE TABLE IF NOT EXISTS ldap_sync_logs (
    id VARCHAR(36) PRIMARY KEY,
    company_id VARCHAR(36) NOT NULL,
    action VARCHAR(50) NOT NULL,
    username VARCHAR(255),
    ldap_group VARCHAR(255),
    status VARCHAR(50) NOT NULL,
    error_message TEXT,
    performed_by VARCHAR(255),
    performed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_ldap_company (company_id),
    INDEX idx_ldap_performed (performed_at)
);
