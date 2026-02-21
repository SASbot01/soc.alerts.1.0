-- Correlation events: records every correlation rule match
CREATE TABLE IF NOT EXISTS correlation_events (
    id VARCHAR(36) PRIMARY KEY,
    company_id VARCHAR(36) NOT NULL,
    rule_id VARCHAR(36) NOT NULL,
    threat_event_id VARCHAR(36) NOT NULL,
    incident_id VARCHAR(36),
    matched_at DATETIME NOT NULL,
    details TEXT,
    INDEX idx_ce_company_matched (company_id, matched_at),
    INDEX idx_ce_rule (rule_id),
    INDEX idx_ce_threat (threat_event_id)
);

-- Add chain_sequence column to correlation_rules for attack_chain rule type
ALTER TABLE correlation_rules ADD COLUMN chain_sequence TEXT;

-- Insert predefined attack chain rules
INSERT INTO correlation_rules (id, name, description, rule_type, threshold_count, time_window_minutes, threat_type, min_severity, creates_incident, incident_severity, is_active, created_at, chain_sequence)
VALUES
    ('chain-recon-breach', 'Reconnaissance to Breach',
     'Detects attack chain: PORT_SCAN -> BRUTE_FORCE -> UNAUTHORIZED_ACCESS from the same source IP within 60 minutes',
     'attack_chain', 1, 60, NULL, NULL, true, 'critical', NOW(),
     '["PORT_SCAN","BRUTE_FORCE","UNAUTHORIZED_ACCESS"]'),

    ('chain-scan-exploit', 'Scan to Exploit',
     'Detects attack chain: PORT_SCAN -> EXPLOIT -> LATERAL_MOVEMENT from the same source IP within 120 minutes',
     'attack_chain', 1, 120, NULL, NULL, true, 'critical', NOW(),
     '["PORT_SCAN","EXPLOIT","LATERAL_MOVEMENT"]');
