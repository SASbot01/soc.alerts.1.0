-- V32: Marketplace — Community content sharing

CREATE TABLE marketplace_items (
    id VARCHAR(36) PRIMARY KEY,
    item_type VARCHAR(50) NOT NULL COMMENT 'detection_rule, playbook_template, correlation_rule, integration_connector',
    title VARCHAR(200) NOT NULL,
    description TEXT NULL,
    author VARCHAR(200) NULL,
    version VARCHAR(20) DEFAULT '1.0.0',
    content JSON NOT NULL COMMENT 'The actual content (rule YAML, playbook JSON, etc.)',
    tags VARCHAR(500) NULL,
    category VARCHAR(100) NULL,
    downloads INT DEFAULT 0,
    rating DOUBLE DEFAULT 0,
    rating_count INT DEFAULT 0,
    is_verified BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_mp_type (item_type),
    INDEX idx_mp_category (category),
    INDEX idx_mp_downloads (downloads)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE marketplace_installations (
    id VARCHAR(36) PRIMARY KEY,
    company_id VARCHAR(36) NOT NULL,
    item_id VARCHAR(36) NOT NULL,
    installed_version VARCHAR(20) NULL,
    installed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    installed_by VARCHAR(36) NULL,
    is_active BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    FOREIGN KEY (item_id) REFERENCES marketplace_items(id) ON DELETE CASCADE,
    UNIQUE KEY uk_install (company_id, item_id),
    INDEX idx_install_company (company_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
