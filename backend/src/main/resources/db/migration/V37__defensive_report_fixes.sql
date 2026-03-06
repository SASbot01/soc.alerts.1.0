-- V37: Defensive report fixes — subnet blocking, correlation tuning, performance indexes

-- 1. Blocked subnets table for CIDR-level blocking
CREATE TABLE IF NOT EXISTS blocked_subnets (
    cidr VARCHAR(43) NOT NULL,
    company_id VARCHAR(36) NOT NULL,
    reason TEXT,
    blocked_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME,
    blocked_by VARCHAR(100),
    PRIMARY KEY (cidr, company_id)
);

-- 2. Seed permanent blocks for known malicious subnets (all companies)
INSERT IGNORE INTO blocked_subnets (cidr, company_id, reason, blocked_at, expires_at, blocked_by)
SELECT '91.230.168.0/24', id, 'Coordinated brute-force campaign — identified by AI defensive report', NOW(), NULL, 'ai-agent'
FROM companies;

INSERT IGNORE INTO blocked_subnets (cidr, company_id, reason, blocked_at, expires_at, blocked_by)
SELECT '195.184.76.0/24', id, 'Coordinated brute-force campaign — identified by AI defensive report', NOW(), NULL, 'ai-agent'
FROM companies;

-- 3. Raise brute force correlation rule threshold: 5 → 15 occurrences, window 10 → 15 min
UPDATE correlation_rules
SET threshold_count = 15, time_window_minutes = 15
WHERE rule_type = 'same_ip_same_type'
  AND threat_type IN ('BRUTE_FORCE', 'brute_force', 'Brute Force', 'SSH_BRUTE_FORCE');

-- 4. Add same_subnet_threshold correlation rule (5 threats from same /24 in 30 min)
INSERT IGNORE INTO correlation_rules (id, name, description, rule_type, threshold_count, time_window_minutes,
    threat_type, min_severity, creates_incident, incident_severity, is_active, created_at)
VALUES (
    'rule-subnet-threshold',
    'Same Subnet Coordinated Attack',
    'Triggers when 5+ threats originate from the same /24 subnet within 30 minutes, indicating a coordinated campaign',
    'same_subnet_threshold',
    5,
    30,
    NULL,
    5,
    1,
    'high',
    1,
    NOW()
);

-- 5. Performance indexes on threat_events and incidents
-- MySQL 8.0 does not support CREATE INDEX IF NOT EXISTS, so we use procedures or just create them
CREATE INDEX idx_threat_events_company_timestamp
    ON threat_events (company_id, timestamp DESC);

CREATE INDEX idx_threat_events_company_srcip_type_timestamp
    ON threat_events (company_id, src_ip, threat_type, timestamp);

CREATE INDEX idx_incidents_company_status
    ON incidents (company_id, status);

CREATE INDEX idx_incidents_company_created
    ON incidents (company_id, created_at DESC);

CREATE INDEX idx_blocked_ips_company_expires
    ON blocked_ips (company_id, expires_at);

CREATE INDEX idx_alert_history_company_sentat
    ON alert_history (company_id, sent_at DESC);
