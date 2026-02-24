-- SSO/OIDC configuration per company
CREATE TABLE sso_configurations (
    id VARCHAR(36) PRIMARY KEY,
    company_id VARCHAR(36) NOT NULL UNIQUE,
    provider VARCHAR(50) NOT NULL,
    client_id VARCHAR(500) NOT NULL,
    client_secret VARCHAR(500) NOT NULL,
    issuer_url VARCHAR(500) NOT NULL,
    auto_provision_users BOOLEAN DEFAULT TRUE,
    default_role VARCHAR(50) DEFAULT 'analyst',
    allowed_domains VARCHAR(1000),
    is_active BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    INDEX idx_sso_company (company_id),
    INDEX idx_sso_active (is_active)
);
