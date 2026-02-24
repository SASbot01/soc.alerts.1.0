-- V28: AI Cortex — Learning events and cross-tenant intelligence

CREATE TABLE ai_learning_events (
    id VARCHAR(36) PRIMARY KEY,
    company_id VARCHAR(36) NOT NULL,
    event_type VARCHAR(50) NOT NULL COMMENT 'decision, override, adjustment',
    original_verdict VARCHAR(100) NULL,
    corrected_verdict VARCHAR(100) NULL,
    threat_type VARCHAR(100) NULL,
    threat_event_id VARCHAR(36) NULL,
    context JSON NULL,
    confidence DOUBLE NULL,
    learned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    INDEX idx_learning_company (company_id),
    INDEX idx_learning_type (event_type),
    INDEX idx_learning_date (learned_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE cross_tenant_patterns (
    id VARCHAR(36) PRIMARY KEY,
    pattern_type VARCHAR(50) NOT NULL COMMENT 'ip_reputation, threat_campaign, attack_pattern',
    pattern_data JSON NOT NULL,
    confidence DOUBLE DEFAULT 0.5,
    source_count INT DEFAULT 1 COMMENT 'Number of tenants that contributed',
    first_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    INDEX idx_pattern_type (pattern_type),
    INDEX idx_pattern_active (is_active),
    INDEX idx_pattern_confidence (confidence)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE ai_performance_metrics (
    id VARCHAR(36) PRIMARY KEY,
    company_id VARCHAR(36) NULL COMMENT 'NULL for global metrics',
    metric_date DATE NOT NULL,
    total_decisions INT DEFAULT 0,
    correct_decisions INT DEFAULT 0,
    overridden_decisions INT DEFAULT 0,
    auto_blocked_ips INT DEFAULT 0,
    auto_created_incidents INT DEFAULT 0,
    false_positive_rate DOUBLE NULL,
    mean_response_time_ms BIGINT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_perf_company (company_id),
    INDEX idx_perf_date (metric_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
