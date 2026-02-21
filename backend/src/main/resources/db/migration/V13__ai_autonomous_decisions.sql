-- =============================================
-- V13: AI Autonomous Agent - Decisions & Noise Suppression
-- =============================================

-- AI autonomous decisions: tracks every decision the AI agent makes
CREATE TABLE ai_decisions (
    id VARCHAR(36) PRIMARY KEY,
    company_id VARCHAR(255) NOT NULL,
    threat_event_id VARCHAR(36) NOT NULL,

    -- AI classification
    verdict ENUM('NOISE', 'FALSE_POSITIVE', 'LEGITIMATE_SCAN', 'SUSPICIOUS', 'REAL_ATTACK', 'CRITICAL_ATTACK') NOT NULL,
    confidence DECIMAL(3,2) NOT NULL COMMENT '0.00 to 1.00',
    reasoning TEXT NOT NULL,

    -- Actions taken
    actions_taken TEXT COMMENT 'JSON array of actions executed',
    incident_created_id VARCHAR(36),
    ip_blocked BOOLEAN DEFAULT FALSE,
    playbook_executed_id VARCHAR(36),
    threat_status_updated VARCHAR(20),

    -- Context
    batch_id VARCHAR(36) COMMENT 'Groups threats analyzed together',
    tokens_used INT DEFAULT 0,
    analysis_mode ENUM('IMMEDIATE', 'BATCH', 'SUPPRESSED') NOT NULL,

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_ai_decisions_company (company_id),
    INDEX idx_ai_decisions_threat (threat_event_id),
    INDEX idx_ai_decisions_verdict (company_id, verdict),
    INDEX idx_ai_decisions_batch (batch_id),
    INDEX idx_ai_decisions_date (company_id, created_at),
    CONSTRAINT fk_ai_decisions_company FOREIGN KEY (company_id) REFERENCES companies(id),
    CONSTRAINT fk_ai_decisions_threat FOREIGN KEY (threat_event_id) REFERENCES threat_events(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Learned noise patterns: the AI learns which threat patterns are noise
CREATE TABLE ai_noise_patterns (
    id VARCHAR(36) PRIMARY KEY,
    company_id VARCHAR(255) NOT NULL,

    -- Pattern matching criteria
    src_ip VARCHAR(45),
    threat_type VARCHAR(100),
    dst_port INT,
    description_pattern VARCHAR(500) COMMENT 'Regex or substring to match',

    -- Metadata
    reason TEXT NOT NULL COMMENT 'Why this pattern is considered noise',
    suppressed_count INT DEFAULT 0 COMMENT 'How many threats this pattern has suppressed',
    last_seen DATETIME,
    is_active BOOLEAN DEFAULT TRUE,
    expires_at DATETIME COMMENT 'Auto-expire patterns after a period',

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(50) DEFAULT 'ai-agent' COMMENT 'ai-agent or manual',

    INDEX idx_noise_company (company_id, is_active),
    INDEX idx_noise_pattern (company_id, src_ip, threat_type),
    CONSTRAINT fk_noise_company FOREIGN KEY (company_id) REFERENCES companies(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
