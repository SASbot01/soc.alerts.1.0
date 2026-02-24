-- V27: Threat Hunting — saved hunts and scheduled queries

CREATE TABLE saved_hunts (
    id VARCHAR(36) PRIMARY KEY,
    company_id VARCHAR(36) NOT NULL,
    name VARCHAR(200) NOT NULL,
    description TEXT NULL,
    query_config JSON NOT NULL COMMENT 'Full query definition: filters, time range, etc.',
    hunt_type VARCHAR(50) DEFAULT 'manual' COMMENT 'manual, scheduled, template',
    schedule_cron VARCHAR(50) NULL COMMENT 'Cron for scheduled hunts',
    is_active BOOLEAN DEFAULT TRUE,
    last_run_at DATETIME NULL,
    last_result_count INT NULL,
    tags VARCHAR(500) NULL COMMENT 'Comma-separated tags',
    created_by VARCHAR(36) NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    INDEX idx_hunts_company (company_id),
    INDEX idx_hunts_type (hunt_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE hunt_results (
    id VARCHAR(36) PRIMARY KEY,
    hunt_id VARCHAR(36) NOT NULL,
    company_id VARCHAR(36) NOT NULL,
    result_count INT DEFAULT 0,
    execution_time_ms BIGINT NULL,
    findings JSON NULL COMMENT 'Summary of interesting findings',
    executed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    executed_by VARCHAR(36) NULL,
    FOREIGN KEY (hunt_id) REFERENCES saved_hunts(id) ON DELETE CASCADE,
    INDEX idx_results_hunt (hunt_id),
    INDEX idx_results_company (company_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
