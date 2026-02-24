-- =============================================================
-- V15: Fix correlation rules – match actual sensor threat types
--      and lower critical threshold from 9 to 8
-- =============================================================

-- Fix brute force rule: sensor sends "BRUTE_FORCE" not "Brute Force"
UPDATE correlation_rules
SET threat_type = 'BRUTE_FORCE',
    name        = 'Brute Force Detection',
    description = 'Detects multiple BRUTE_FORCE attempts from same IP in short window'
WHERE id = 'rule-brute-force';

-- Fix DDoS rule: sensor sends "DDOS" not "DDoS"
UPDATE correlation_rules
SET threat_type = 'DDOS',
    name        = 'DDoS Detection',
    description = 'Detects DDOS attacks with high frequency from multiple sources'
WHERE id = 'rule-ddos';

-- Lower critical auto-incident threshold from 9 to 8
-- so EXPLOIT (Level 8) and BRUTE_FORCE (Level 8) also create incidents
UPDATE correlation_rules
SET min_severity = 8,
    description  = 'Any threat with severity >= 8 creates incident automatically'
WHERE id = 'rule-critical-any';

-- Add new rules for threat types seen in production (without chain_sequence)
INSERT IGNORE INTO correlation_rules
    (id, name, description, rule_type, threshold_count, time_window_minutes,
     threat_type, min_severity, creates_incident, incident_severity, is_active, created_at)
VALUES
    ('rule-exploit', 'Exploit Detection',
     'Detects multiple EXPLOIT attempts from same IP in short window',
     'same_ip_same_type', 3, 10, 'EXPLOIT', 1, TRUE, 'critical', TRUE, NOW()),

    ('rule-port-scan', 'Port Scan Detection',
     'Detects multiple PORT_SCAN events from same IP in short window',
     'same_ip_same_type', 5, 10, 'PORT_SCAN', 1, TRUE, 'medium', TRUE, NOW());

-- Add attack chain rules (with chain_sequence column)
INSERT IGNORE INTO correlation_rules
    (id, name, description, rule_type, threshold_count, time_window_minutes,
     threat_type, min_severity, creates_incident, incident_severity, is_active, created_at, chain_sequence)
VALUES
    ('rule-recon-to-exploit', 'Reconnaissance to Exploit Chain',
     'Detects attack chain: RECONNAISSANCE -> PORT_SCAN -> EXPLOIT from same source IP',
     'attack_chain', 1, 30, NULL, NULL, TRUE, 'critical', TRUE, NOW(),
     '["RECONNAISSANCE","PORT_SCAN","EXPLOIT"]'),

    ('rule-scan-brute-exploit', 'Scan-Brute-Exploit Chain',
     'Detects attack chain: PORT_SCAN -> BRUTE_FORCE -> EXPLOIT from same source IP',
     'attack_chain', 1, 30, NULL, NULL, TRUE, 'critical', TRUE, NOW(),
     '["PORT_SCAN","BRUTE_FORCE","EXPLOIT"]');
