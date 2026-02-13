-- V9: Predefined playbook templates + asset-playbook assignments

-- 1. Add template columns to playbooks
ALTER TABLE playbooks ADD COLUMN is_template BOOLEAN DEFAULT FALSE;
ALTER TABLE playbooks ADD COLUMN category VARCHAR(50);
ALTER TABLE playbooks ADD COLUMN source_template_id VARCHAR(36);
ALTER TABLE playbooks ADD COLUMN mitre_techniques VARCHAR(500);
ALTER TABLE playbooks ADD COLUMN target_asset_types VARCHAR(500);

-- 2. Create asset_playbook_assignments join table
CREATE TABLE IF NOT EXISTS asset_playbook_assignments (
    asset_id VARCHAR(36) NOT NULL,
    playbook_id VARCHAR(36) NOT NULL,
    assigned_at DATETIME NOT NULL,
    assigned_by VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    priority INT DEFAULT 0,
    PRIMARY KEY (asset_id, playbook_id),
    FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE,
    FOREIGN KEY (playbook_id) REFERENCES playbooks(id) ON DELETE CASCADE
);

-- 3. Insert SYSTEM company for templates
INSERT IGNORE INTO companies (id, company_name, domain, contact_email, api_key, status, registered_at)
VALUES ('SYSTEM', 'BlackWolf Templates', 'system.blackwolf.io', 'system@blackwolf.io', 'SYSTEM-NO-ACCESS', 'system', NOW());

-- 4. Seed 15 playbook templates

-- Template 1: Brute Force Response
INSERT INTO playbooks (id, company_id, name, description, trigger_type, trigger_condition, is_active, is_template, category, mitre_techniques, target_asset_types, created_at, updated_at)
VALUES ('TPL-001', 'SYSTEM', 'Brute Force Response', 'Automated response to brute force login attempts. Enriches threat intelligence, blocks the attacking IP for 48 hours, creates a HIGH severity incident, sends alerts, and forwards IOCs to SIEM.', 'THREAT_TYPE', 'BRUTE_FORCE', TRUE, TRUE, 'BRUTE_FORCE', 'T1110', 'SERVER,ENDPOINT,APPLICATION', NOW(), NOW());

INSERT INTO playbook_steps (id, playbook_id, step_order, action_type, action_config, description, created_at) VALUES
('TPL-001-S1', 'TPL-001', 1, 'ENRICH_IP', '{"feeds":["abuseipdb","virustotal"],"cache_hours":24}', 'Enrich source IP with threat intelligence feeds', NOW()),
('TPL-001-S2', 'TPL-001', 2, 'BLOCK_IP', '{"duration_hours":48,"reason":"Brute force attack detected - automated block"}', 'Block attacking IP for 48 hours', NOW()),
('TPL-001-S3', 'TPL-001', 3, 'CREATE_INCIDENT', '{"severity":"high","title_prefix":"Brute Force Attack","description":"Automated incident from brute force detection playbook"}', 'Create HIGH severity incident', NOW()),
('TPL-001-S4', 'TPL-001', 4, 'SEND_ALERT', '{"channels":["email"],"priority":"high","template":"brute_force_detected"}', 'Send email alert to SOC team', NOW()),
('TPL-001-S5', 'TPL-001', 5, 'WEBHOOK_CALL', '{"url":"${SIEM_WEBHOOK}","method":"POST","payload_template":"ioc_submit","description":"Forward IOC to SIEM"}', 'Forward IOC indicators to SIEM', NOW());

-- Template 2: DDoS Mitigation
INSERT INTO playbooks (id, company_id, name, description, trigger_type, trigger_condition, is_active, is_template, category, mitre_techniques, target_asset_types, created_at, updated_at)
VALUES ('TPL-002', 'SYSTEM', 'DDoS Mitigation', 'Immediate response to DDoS attacks. Creates CRITICAL incident, sends SMS alerts, activates upstream scrubbing, enriches threat data, and notifies NOC via Slack.', 'THREAT_TYPE', 'DDOS', TRUE, TRUE, 'DDOS', 'T1498', 'SERVER,NETWORK_DEVICE,APPLICATION,CLOUD_RESOURCE', NOW(), NOW());

INSERT INTO playbook_steps (id, playbook_id, step_order, action_type, action_config, description, created_at) VALUES
('TPL-002-S1', 'TPL-002', 1, 'CREATE_INCIDENT', '{"severity":"critical","title_prefix":"DDoS Attack","description":"Active DDoS attack detected - immediate response required"}', 'Create CRITICAL incident immediately', NOW()),
('TPL-002-S2', 'TPL-002', 2, 'SEND_ALERT', '{"channels":["email","sms"],"priority":"critical","template":"ddos_attack"}', 'Send SMS and email alert to SOC', NOW()),
('TPL-002-S3', 'TPL-002', 3, 'WEBHOOK_CALL', '{"url":"${SCRUBBING_WEBHOOK}","method":"POST","payload_template":"ddos_scrubbing","description":"Activate upstream DDoS scrubbing"}', 'Activate upstream traffic scrubbing', NOW()),
('TPL-002-S4', 'TPL-002', 4, 'ENRICH_IP', '{"feeds":["abuseipdb","shodan"],"cache_hours":1}', 'Enrich attacking IPs for attribution', NOW()),
('TPL-002-S5', 'TPL-002', 5, 'NOTIFY_SLACK', '{"channel":"#noc-alerts","message_template":"DDoS attack in progress. Incident created. Scrubbing activated.","mention":"@noc-team"}', 'Notify NOC team via Slack', NOW());

-- Template 3: Ransomware Containment
INSERT INTO playbooks (id, company_id, name, description, trigger_type, trigger_condition, is_active, is_template, category, mitre_techniques, target_asset_types, created_at, updated_at)
VALUES ('TPL-003', 'SYSTEM', 'Ransomware Containment', 'Critical ransomware response. Immediately blocks source for 30 days, creates CRITICAL incident, sends SMS alerts, enriches IOCs across all feeds, pushes to SIEM, and notifies IR team.', 'THREAT_TYPE', 'RANSOMWARE', TRUE, TRUE, 'RANSOMWARE', 'T1486,T1059', 'SERVER,ENDPOINT,DATABASE', NOW(), NOW());

INSERT INTO playbook_steps (id, playbook_id, step_order, action_type, action_config, description, created_at) VALUES
('TPL-003-S1', 'TPL-003', 1, 'BLOCK_IP', '{"duration_hours":720,"reason":"Ransomware activity detected - 30 day block"}', 'Block source IP for 30 days', NOW()),
('TPL-003-S2', 'TPL-003', 2, 'CREATE_INCIDENT', '{"severity":"critical","title_prefix":"Ransomware Detected","description":"Ransomware activity detected - containment initiated"}', 'Create CRITICAL incident', NOW()),
('TPL-003-S3', 'TPL-003', 3, 'SEND_ALERT', '{"channels":["email","sms"],"priority":"critical","template":"ransomware_alert"}', 'Send SMS alert to IR team', NOW()),
('TPL-003-S4', 'TPL-003', 4, 'ENRICH_IP', '{"feeds":["abuseipdb","virustotal","otx"],"cache_hours":1}', 'Enrich IOCs across all threat feeds', NOW()),
('TPL-003-S5', 'TPL-003', 5, 'WEBHOOK_CALL', '{"url":"${SIEM_WEBHOOK}","method":"POST","payload_template":"ioc_submit","description":"Push IOCs to SIEM for correlation"}', 'Push IOC indicators to SIEM', NOW()),
('TPL-003-S6', 'TPL-003', 6, 'NOTIFY_SLACK', '{"channel":"#incident-response","message_template":"CRITICAL: Ransomware detected. Source blocked 30d. Incident created. Investigate immediately.","mention":"@ir-team"}', 'Notify IR team via Slack', NOW());

-- Template 4: Malware Quarantine
INSERT INTO playbooks (id, company_id, name, description, trigger_type, trigger_condition, is_active, is_template, category, mitre_techniques, target_asset_types, created_at, updated_at)
VALUES ('TPL-004', 'SYSTEM', 'Malware Quarantine', 'Malware detection response. Enriches threat data, blocks source for 7 days, creates HIGH incident, sends alerts, and triggers EDR quarantine action.', 'THREAT_TYPE', 'MALWARE', TRUE, TRUE, 'MALWARE', 'T1059,T1027', 'SERVER,ENDPOINT', NOW(), NOW());

INSERT INTO playbook_steps (id, playbook_id, step_order, action_type, action_config, description, created_at) VALUES
('TPL-004-S1', 'TPL-004', 1, 'ENRICH_IP', '{"feeds":["virustotal","malwarebazaar"],"cache_hours":4}', 'Enrich with malware-specific threat feeds', NOW()),
('TPL-004-S2', 'TPL-004', 2, 'BLOCK_IP', '{"duration_hours":168,"reason":"Malware communication detected - 7 day block"}', 'Block source IP for 7 days', NOW()),
('TPL-004-S3', 'TPL-004', 3, 'CREATE_INCIDENT', '{"severity":"high","title_prefix":"Malware Detected","description":"Malware activity detected - quarantine initiated"}', 'Create HIGH severity incident', NOW()),
('TPL-004-S4', 'TPL-004', 4, 'SEND_ALERT', '{"channels":["email"],"priority":"high","template":"malware_detected"}', 'Send alert to SOC team', NOW()),
('TPL-004-S5', 'TPL-004', 5, 'WEBHOOK_CALL', '{"url":"${EDR_WEBHOOK}","method":"POST","payload_template":"edr_quarantine","description":"Trigger EDR quarantine action"}', 'Trigger EDR endpoint quarantine', NOW());

-- Template 5: Phishing Response
INSERT INTO playbooks (id, company_id, name, description, trigger_type, trigger_condition, is_active, is_template, category, mitre_techniques, target_asset_types, created_at, updated_at)
VALUES ('TPL-005', 'SYSTEM', 'Phishing Response', 'Phishing attack response. Enriches sender/URL reputation, blocks phishing source for 30 days, creates HIGH incident, alerts SOC, and sends awareness notification.', 'THREAT_TYPE', 'PHISHING', TRUE, TRUE, 'PHISHING', 'T1078,T1133', 'ENDPOINT,APPLICATION,SERVER', NOW(), NOW());

INSERT INTO playbook_steps (id, playbook_id, step_order, action_type, action_config, description, created_at) VALUES
('TPL-005-S1', 'TPL-005', 1, 'ENRICH_IP', '{"feeds":["abuseipdb","urlhaus","phishtank"],"cache_hours":2}', 'Enrich phishing source with reputation feeds', NOW()),
('TPL-005-S2', 'TPL-005', 2, 'BLOCK_IP', '{"duration_hours":720,"reason":"Phishing source identified - 30 day block"}', 'Block phishing source for 30 days', NOW()),
('TPL-005-S3', 'TPL-005', 3, 'CREATE_INCIDENT', '{"severity":"high","title_prefix":"Phishing Attack","description":"Phishing attempt detected and blocked"}', 'Create HIGH severity incident', NOW()),
('TPL-005-S4', 'TPL-005', 4, 'SEND_ALERT', '{"channels":["email"],"priority":"high","template":"phishing_alert"}', 'Send alert to SOC team', NOW()),
('TPL-005-S5', 'TPL-005', 5, 'NOTIFY_SLACK', '{"channel":"#security-awareness","message_template":"Phishing attempt detected and blocked. Source added to blocklist. Review affected users.","mention":"@security-team"}', 'Send awareness notification via Slack', NOW());

-- Template 6: Port Scan Detection
INSERT INTO playbooks (id, company_id, name, description, trigger_type, trigger_condition, is_active, is_template, category, mitre_techniques, target_asset_types, created_at, updated_at)
VALUES ('TPL-006', 'SYSTEM', 'Port Scan Detection', 'Reconnaissance detection response. Enriches scanner IP, creates MEDIUM incident for tracking, notifies SOC via Slack, and sends data to SIEM for correlation.', 'THREAT_TYPE', 'PORT_SCAN', TRUE, TRUE, 'PORT_SCAN', 'T1046,T1595', 'SERVER,NETWORK_DEVICE,CLOUD_RESOURCE', NOW(), NOW());

INSERT INTO playbook_steps (id, playbook_id, step_order, action_type, action_config, description, created_at) VALUES
('TPL-006-S1', 'TPL-006', 1, 'ENRICH_IP', '{"feeds":["abuseipdb","shodan"],"cache_hours":12}', 'Enrich scanner IP with intelligence', NOW()),
('TPL-006-S2', 'TPL-006', 2, 'CREATE_INCIDENT', '{"severity":"medium","title_prefix":"Port Scan Detected","description":"Network reconnaissance activity detected"}', 'Create MEDIUM severity incident', NOW()),
('TPL-006-S3', 'TPL-006', 3, 'NOTIFY_SLACK', '{"channel":"#soc-alerts","message_template":"Port scan detected from external source. Incident created for tracking.","mention":"@soc-analysts"}', 'Notify SOC via Slack', NOW()),
('TPL-006-S4', 'TPL-006', 4, 'WEBHOOK_CALL', '{"url":"${SIEM_WEBHOOK}","method":"POST","payload_template":"correlation_event","description":"Send to SIEM for correlation with other recon activity"}', 'Send to SIEM for correlation', NOW());

-- Template 7: Unauthorized Access
INSERT INTO playbooks (id, company_id, name, description, trigger_type, trigger_condition, is_active, is_template, category, mitre_techniques, target_asset_types, created_at, updated_at)
VALUES ('TPL-007', 'SYSTEM', 'Unauthorized Access Response', 'Unauthorized access response. Blocks source for 72 hours, enriches threat data, creates CRITICAL incident, sends alerts, and triggers IAM review webhook.', 'THREAT_TYPE', 'UNAUTHORIZED_ACCESS', TRUE, TRUE, 'UNAUTHORIZED_ACCESS', 'T1078,T1021', 'SERVER,DATABASE,APPLICATION,CLOUD_RESOURCE', NOW(), NOW());

INSERT INTO playbook_steps (id, playbook_id, step_order, action_type, action_config, description, created_at) VALUES
('TPL-007-S1', 'TPL-007', 1, 'BLOCK_IP', '{"duration_hours":72,"reason":"Unauthorized access attempt - 72 hour block"}', 'Block source IP for 72 hours', NOW()),
('TPL-007-S2', 'TPL-007', 2, 'ENRICH_IP', '{"feeds":["abuseipdb","virustotal"],"cache_hours":4}', 'Enrich source with threat intelligence', NOW()),
('TPL-007-S3', 'TPL-007', 3, 'CREATE_INCIDENT', '{"severity":"critical","title_prefix":"Unauthorized Access","description":"Unauthorized access detected - immediate investigation required"}', 'Create CRITICAL incident', NOW()),
('TPL-007-S4', 'TPL-007', 4, 'SEND_ALERT', '{"channels":["email","sms"],"priority":"critical","template":"unauthorized_access"}', 'Send critical alert to SOC', NOW()),
('TPL-007-S5', 'TPL-007', 5, 'WEBHOOK_CALL', '{"url":"${IAM_WEBHOOK}","method":"POST","payload_template":"iam_review","description":"Trigger IAM access review"}', 'Trigger IAM access review', NOW());

-- Template 8: Web Attack (SQLi/XSS)
INSERT INTO playbooks (id, company_id, name, description, trigger_type, trigger_condition, is_active, is_template, category, mitre_techniques, target_asset_types, created_at, updated_at)
VALUES ('TPL-008', 'SYSTEM', 'Web Attack Response (SQLi/XSS)', 'Web application attack response. Blocks attacker for 7 days, enriches source, creates HIGH incident, updates WAF rules via webhook, and sends alert.', 'THREAT_TYPE', 'SQL_INJECTION', TRUE, TRUE, 'WEB_ATTACK', 'T1190', 'APPLICATION,SERVER,CLOUD_RESOURCE', NOW(), NOW());

INSERT INTO playbook_steps (id, playbook_id, step_order, action_type, action_config, description, created_at) VALUES
('TPL-008-S1', 'TPL-008', 1, 'BLOCK_IP', '{"duration_hours":168,"reason":"Web application attack (SQLi/XSS) - 7 day block"}', 'Block attacker IP for 7 days', NOW()),
('TPL-008-S2', 'TPL-008', 2, 'ENRICH_IP', '{"feeds":["abuseipdb","virustotal"],"cache_hours":4}', 'Enrich attacker IP', NOW()),
('TPL-008-S3', 'TPL-008', 3, 'CREATE_INCIDENT', '{"severity":"high","title_prefix":"Web Application Attack","description":"SQL injection or XSS attack detected on web application"}', 'Create HIGH severity incident', NOW()),
('TPL-008-S4', 'TPL-008', 4, 'WEBHOOK_CALL', '{"url":"${WAF_WEBHOOK}","method":"POST","payload_template":"waf_block_rule","description":"Add blocking rule to WAF"}', 'Update WAF blocking rules', NOW()),
('TPL-008-S5', 'TPL-008', 5, 'SEND_ALERT', '{"channels":["email"],"priority":"high","template":"web_attack"}', 'Send alert to application security team', NOW());

-- Template 9: C2 Communication
INSERT INTO playbooks (id, company_id, name, description, trigger_type, trigger_condition, is_active, is_template, category, mitre_techniques, target_asset_types, created_at, updated_at)
VALUES ('TPL-009', 'SYSTEM', 'C2 Communication Detection', 'Command & Control traffic response. Immediately blocks C2 for 30 days, creates CRITICAL incident, enriches across all feeds, sends SMS alert, pushes IOCs to SIEM, and notifies IR.', 'THREAT_TYPE', 'C2', TRUE, TRUE, 'C2_COMMUNICATION', 'T1071,T1133', 'SERVER,ENDPOINT,NETWORK_DEVICE,IOT_DEVICE', NOW(), NOW());

INSERT INTO playbook_steps (id, playbook_id, step_order, action_type, action_config, description, created_at) VALUES
('TPL-009-S1', 'TPL-009', 1, 'BLOCK_IP', '{"duration_hours":720,"reason":"C2 communication detected - 30 day block"}', 'Block C2 IP for 30 days', NOW()),
('TPL-009-S2', 'TPL-009', 2, 'CREATE_INCIDENT', '{"severity":"critical","title_prefix":"C2 Communication","description":"Command and control traffic detected - host potentially compromised"}', 'Create CRITICAL incident', NOW()),
('TPL-009-S3', 'TPL-009', 3, 'ENRICH_IP', '{"feeds":["abuseipdb","virustotal","otx","c2tracker"],"cache_hours":1}', 'Enrich C2 IP across all threat feeds', NOW()),
('TPL-009-S4', 'TPL-009', 4, 'SEND_ALERT', '{"channels":["email","sms"],"priority":"critical","template":"c2_detected"}', 'Send SMS alert to IR team', NOW()),
('TPL-009-S5', 'TPL-009', 5, 'WEBHOOK_CALL', '{"url":"${SIEM_WEBHOOK}","method":"POST","payload_template":"ioc_submit","description":"Push C2 IOCs to SIEM for threat hunting"}', 'Push IOCs to SIEM for hunting', NOW()),
('TPL-009-S6', 'TPL-009', 6, 'NOTIFY_SLACK', '{"channel":"#incident-response","message_template":"CRITICAL: C2 communication detected. Source blocked. Host may be compromised. Begin threat hunt.","mention":"@ir-team"}', 'Notify IR team via Slack', NOW());

-- Template 10: Lateral Movement
INSERT INTO playbooks (id, company_id, name, description, trigger_type, trigger_condition, is_active, is_template, category, mitre_techniques, target_asset_types, created_at, updated_at)
VALUES ('TPL-010', 'SYSTEM', 'Lateral Movement Detection', 'Lateral movement response. Creates CRITICAL incident, blocks source, enriches threat data, sends SMS alert, initiates SIEM threat hunt, and notifies IR team.', 'THREAT_TYPE', 'LATERAL_MOVEMENT', TRUE, TRUE, 'LATERAL_MOVEMENT', 'T1021,T1078', 'SERVER,ENDPOINT,DATABASE,CLOUD_RESOURCE', NOW(), NOW());

INSERT INTO playbook_steps (id, playbook_id, step_order, action_type, action_config, description, created_at) VALUES
('TPL-010-S1', 'TPL-010', 1, 'CREATE_INCIDENT', '{"severity":"critical","title_prefix":"Lateral Movement","description":"Lateral movement detected - potential breach in progress"}', 'Create CRITICAL incident immediately', NOW()),
('TPL-010-S2', 'TPL-010', 2, 'BLOCK_IP', '{"duration_hours":168,"reason":"Lateral movement detected - 7 day block"}', 'Block source of lateral movement', NOW()),
('TPL-010-S3', 'TPL-010', 3, 'ENRICH_IP', '{"feeds":["abuseipdb","virustotal"],"cache_hours":1}', 'Enrich source IP', NOW()),
('TPL-010-S4', 'TPL-010', 4, 'SEND_ALERT', '{"channels":["email","sms"],"priority":"critical","template":"lateral_movement"}', 'Send SMS alert', NOW()),
('TPL-010-S5', 'TPL-010', 5, 'WEBHOOK_CALL', '{"url":"${SIEM_WEBHOOK}","method":"POST","payload_template":"threat_hunt","description":"Initiate SIEM threat hunt for lateral movement"}', 'Initiate SIEM threat hunt', NOW()),
('TPL-010-S6', 'TPL-010', 6, 'NOTIFY_SLACK', '{"channel":"#incident-response","message_template":"CRITICAL: Lateral movement detected. Containment initiated. Begin network-wide hunt.","mention":"@ir-team"}', 'Notify IR team via Slack', NOW());

-- Template 11: Privilege Escalation
INSERT INTO playbooks (id, company_id, name, description, trigger_type, trigger_condition, is_active, is_template, category, mitre_techniques, target_asset_types, created_at, updated_at)
VALUES ('TPL-011', 'SYSTEM', 'Privilege Escalation Response', 'Privilege escalation response. Creates CRITICAL incident, sends SMS alert, enriches threat data, triggers IAM audit, and notifies IR team.', 'THREAT_TYPE', 'PRIVILEGE_ESCALATION', TRUE, TRUE, 'PRIVILEGE_ESCALATION', 'T1078,T1053,T1547', 'SERVER,ENDPOINT,DATABASE', NOW(), NOW());

INSERT INTO playbook_steps (id, playbook_id, step_order, action_type, action_config, description, created_at) VALUES
('TPL-011-S1', 'TPL-011', 1, 'CREATE_INCIDENT', '{"severity":"critical","title_prefix":"Privilege Escalation","description":"Privilege escalation attempt detected"}', 'Create CRITICAL incident', NOW()),
('TPL-011-S2', 'TPL-011', 2, 'SEND_ALERT', '{"channels":["email","sms"],"priority":"critical","template":"privilege_escalation"}', 'Send SMS alert', NOW()),
('TPL-011-S3', 'TPL-011', 3, 'ENRICH_IP', '{"feeds":["abuseipdb","virustotal"],"cache_hours":2}', 'Enrich source IP', NOW()),
('TPL-011-S4', 'TPL-011', 4, 'WEBHOOK_CALL', '{"url":"${IAM_WEBHOOK}","method":"POST","payload_template":"iam_audit","description":"Trigger comprehensive IAM privilege audit"}', 'Trigger IAM privilege audit', NOW()),
('TPL-011-S5', 'TPL-011', 5, 'NOTIFY_SLACK', '{"channel":"#incident-response","message_template":"CRITICAL: Privilege escalation detected. IAM audit initiated. Review all elevated permissions.","mention":"@ir-team"}', 'Notify IR team via Slack', NOW());

-- Template 12: Data Exfiltration
INSERT INTO playbooks (id, company_id, name, description, trigger_type, trigger_condition, is_active, is_template, category, mitre_techniques, target_asset_types, created_at, updated_at)
VALUES ('TPL-012', 'SYSTEM', 'Data Exfiltration Response', 'Data exfiltration response. Blocks destination for 30 days, creates CRITICAL incident, enriches threat data, sends SMS alert, activates DLP via SIEM, and notifies IR.', 'THREAT_TYPE', 'DATA_EXFILTRATION', TRUE, TRUE, 'DATA_EXFILTRATION', 'T1071,T1027', 'SERVER,DATABASE,CLOUD_RESOURCE,ENDPOINT', NOW(), NOW());

INSERT INTO playbook_steps (id, playbook_id, step_order, action_type, action_config, description, created_at) VALUES
('TPL-012-S1', 'TPL-012', 1, 'BLOCK_IP', '{"duration_hours":720,"reason":"Data exfiltration destination blocked - 30 day block"}', 'Block exfiltration destination for 30 days', NOW()),
('TPL-012-S2', 'TPL-012', 2, 'CREATE_INCIDENT', '{"severity":"critical","title_prefix":"Data Exfiltration","description":"Potential data exfiltration detected - containment in progress"}', 'Create CRITICAL incident', NOW()),
('TPL-012-S3', 'TPL-012', 3, 'ENRICH_IP', '{"feeds":["abuseipdb","virustotal","otx"],"cache_hours":1}', 'Enrich destination IP', NOW()),
('TPL-012-S4', 'TPL-012', 4, 'SEND_ALERT', '{"channels":["email","sms"],"priority":"critical","template":"data_exfiltration"}', 'Send SMS alert to IR team', NOW()),
('TPL-012-S5', 'TPL-012', 5, 'WEBHOOK_CALL', '{"url":"${SIEM_WEBHOOK}","method":"POST","payload_template":"dlp_alert","description":"Activate DLP monitoring via SIEM"}', 'Activate DLP monitoring in SIEM', NOW()),
('TPL-012-S6', 'TPL-012', 6, 'NOTIFY_SLACK', '{"channel":"#incident-response","message_template":"CRITICAL: Data exfiltration detected. Destination blocked. DLP activated. Begin forensic analysis.","mention":"@ir-team"}', 'Notify IR team via Slack', NOW());

-- Template 13: Insider Threat
INSERT INTO playbooks (id, company_id, name, description, trigger_type, trigger_condition, is_active, is_template, category, mitre_techniques, target_asset_types, created_at, updated_at)
VALUES ('TPL-013', 'SYSTEM', 'Insider Threat Response', 'Insider threat response. Creates HIGH incident (confidential), sends email to management only, enables enhanced SIEM logging, and notifies leadership via private Slack channel.', 'THREAT_TYPE', 'INSIDER_THREAT', TRUE, TRUE, 'INSIDER_THREAT', 'T1078,T1027', 'SERVER,ENDPOINT,NETWORK_DEVICE,APPLICATION,DATABASE,CLOUD_RESOURCE,IOT_DEVICE', NOW(), NOW());

INSERT INTO playbook_steps (id, playbook_id, step_order, action_type, action_config, description, created_at) VALUES
('TPL-013-S1', 'TPL-013', 1, 'CREATE_INCIDENT', '{"severity":"high","title_prefix":"Insider Threat","description":"Potential insider threat activity detected - CONFIDENTIAL"}', 'Create HIGH incident (confidential)', NOW()),
('TPL-013-S2', 'TPL-013', 2, 'SEND_ALERT', '{"channels":["email"],"priority":"high","template":"insider_threat","recipients":"management_only"}', 'Send confidential email to management only', NOW()),
('TPL-013-S3', 'TPL-013', 3, 'WEBHOOK_CALL', '{"url":"${SIEM_WEBHOOK}","method":"POST","payload_template":"enhanced_logging","description":"Enable enhanced audit logging for suspect user"}', 'Enable enhanced SIEM audit logging', NOW()),
('TPL-013-S4', 'TPL-013', 4, 'NOTIFY_SLACK', '{"channel":"#leadership-security","message_template":"CONFIDENTIAL: Insider threat activity detected. Incident created. Enhanced monitoring enabled. Await further guidance.","mention":"@leadership"}', 'Notify leadership via private Slack', NOW());

-- Template 14: Zero-Day Exploit
INSERT INTO playbooks (id, company_id, name, description, trigger_type, trigger_condition, is_active, is_template, category, mitre_techniques, target_asset_types, created_at, updated_at)
VALUES ('TPL-014', 'SYSTEM', 'Zero-Day Exploit Response', 'Zero-day exploit response triggered by high severity (>=9). Blocks source for 30 days, creates CRITICAL incident, enriches across all feeds, sends SMS alert, initiates threat hunt, and notifies IR.', 'THREAT_SEVERITY', '>=9', TRUE, TRUE, 'ZERO_DAY', 'T1190,T1059', 'SERVER,ENDPOINT,NETWORK_DEVICE,APPLICATION,DATABASE,CLOUD_RESOURCE,IOT_DEVICE', NOW(), NOW());

INSERT INTO playbook_steps (id, playbook_id, step_order, action_type, action_config, description, created_at) VALUES
('TPL-014-S1', 'TPL-014', 1, 'BLOCK_IP', '{"duration_hours":720,"reason":"Potential zero-day exploit - 30 day block"}', 'Block source IP for 30 days', NOW()),
('TPL-014-S2', 'TPL-014', 2, 'CREATE_INCIDENT', '{"severity":"critical","title_prefix":"Zero-Day Exploit","description":"Potential zero-day exploit detected - maximum severity response"}', 'Create CRITICAL incident', NOW()),
('TPL-014-S3', 'TPL-014', 3, 'ENRICH_IP', '{"feeds":["abuseipdb","virustotal","otx","shodan","c2tracker"],"cache_hours":1}', 'Enrich source across all available feeds', NOW()),
('TPL-014-S4', 'TPL-014', 4, 'SEND_ALERT', '{"channels":["email","sms"],"priority":"critical","template":"zero_day"}', 'Send SMS alert to IR team', NOW()),
('TPL-014-S5', 'TPL-014', 5, 'WEBHOOK_CALL', '{"url":"${SIEM_WEBHOOK}","method":"POST","payload_template":"threat_hunt","description":"Initiate organization-wide threat hunt for zero-day indicators"}', 'Initiate SIEM threat hunt', NOW()),
('TPL-014-S6', 'TPL-014', 6, 'NOTIFY_SLACK', '{"channel":"#incident-response","message_template":"CRITICAL: Potential zero-day exploit (severity >=9). All hands response. Source blocked. Threat hunt initiated.","mention":"@ir-team @leadership"}', 'Notify IR team and leadership', NOW());

-- Template 15: Compliance Violation
INSERT INTO playbooks (id, company_id, name, description, trigger_type, trigger_condition, is_active, is_template, category, mitre_techniques, target_asset_types, created_at, updated_at)
VALUES ('TPL-015', 'SYSTEM', 'Compliance Violation Response', 'Compliance violation response. Creates HIGH incident, sends email to compliance team, triggers GRC webhook for audit trail, and notifies compliance Slack channel.', 'THREAT_TYPE', 'COMPLIANCE_VIOLATION', TRUE, TRUE, 'COMPLIANCE', 'T1562', 'SERVER,DATABASE,APPLICATION,CLOUD_RESOURCE', NOW(), NOW());

INSERT INTO playbook_steps (id, playbook_id, step_order, action_type, action_config, description, created_at) VALUES
('TPL-015-S1', 'TPL-015', 1, 'CREATE_INCIDENT', '{"severity":"high","title_prefix":"Compliance Violation","description":"Compliance violation detected - audit trail initiated"}', 'Create HIGH severity compliance incident', NOW()),
('TPL-015-S2', 'TPL-015', 2, 'SEND_ALERT', '{"channels":["email"],"priority":"high","template":"compliance_violation","recipients":"compliance_team"}', 'Send email to compliance team', NOW()),
('TPL-015-S3', 'TPL-015', 3, 'WEBHOOK_CALL', '{"url":"${GRC_WEBHOOK}","method":"POST","payload_template":"compliance_event","description":"Log compliance event in GRC platform"}', 'Log event in GRC platform', NOW()),
('TPL-015-S4', 'TPL-015', 4, 'NOTIFY_SLACK', '{"channel":"#compliance","message_template":"Compliance violation detected. Incident created. GRC audit trail initiated. Review required.","mention":"@compliance-team"}', 'Notify compliance team via Slack', NOW());
