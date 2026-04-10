-- Trusted IPs whitelist: IPs that should never be blocked or trigger incidents
CREATE TABLE IF NOT EXISTS trusted_ips (
    id VARCHAR(36) PRIMARY KEY,
    company_id VARCHAR(36) NOT NULL,
    ip VARCHAR(45) NOT NULL,
    cidr VARCHAR(50),
    label VARCHAR(255) NOT NULL,
    reason VARCHAR(1000),
    created_by VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_trusted_ip_company (ip, company_id),
    INDEX idx_trusted_ip_company (company_id)
);
