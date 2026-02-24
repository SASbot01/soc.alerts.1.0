-- V29: SIGMA rules engine

CREATE TABLE sigma_rules (
    id VARCHAR(36) PRIMARY KEY,
    company_id VARCHAR(36) NULL COMMENT 'NULL for global/community rules',
    title VARCHAR(200) NOT NULL,
    description TEXT NULL,
    status VARCHAR(30) DEFAULT 'experimental' COMMENT 'stable, test, experimental, deprecated',
    level VARCHAR(30) DEFAULT 'medium' COMMENT 'informational, low, medium, high, critical',
    rule_yaml TEXT NOT NULL COMMENT 'Full SIGMA rule in YAML format',
    logsource_category VARCHAR(100) NULL,
    logsource_product VARCHAR(100) NULL,
    tags VARCHAR(500) NULL COMMENT 'Comma-separated: attack.t1059, cve.2024.1234',
    mitre_techniques VARCHAR(500) NULL,
    author VARCHAR(200) NULL,
    rule_date DATE NULL,
    is_enabled BOOLEAN DEFAULT TRUE,
    match_count INT DEFAULT 0,
    last_match_at DATETIME NULL,
    source VARCHAR(50) DEFAULT 'custom' COMMENT 'custom, community, sigma-repo',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_sigma_company (company_id),
    INDEX idx_sigma_status (status),
    INDEX idx_sigma_level (level),
    INDEX idx_sigma_enabled (is_enabled),
    INDEX idx_sigma_source (source)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
