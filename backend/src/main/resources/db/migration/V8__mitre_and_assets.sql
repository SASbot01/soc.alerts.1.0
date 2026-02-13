-- =============================================
-- V8: MITRE ATT&CK Framework + Asset Inventory
-- =============================================

-- MITRE ATT&CK Techniques reference table
CREATE TABLE mitre_techniques (
    id VARCHAR(20) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    tactic VARCHAR(100) NOT NULL,
    description TEXT,
    url VARCHAR(500)
);

-- Seed common MITRE ATT&CK techniques
INSERT INTO mitre_techniques (id, name, tactic, description, url) VALUES
    ('T1110', 'Brute Force', 'Credential Access', 'Adversaries may use brute force techniques to gain access to accounts when passwords are unknown or when password hashes are obtained.', 'https://attack.mitre.org/techniques/T1110'),
    ('T1498', 'Network Denial of Service', 'Impact', 'Adversaries may perform Network Denial of Service (NDoS) attacks to degrade or block the availability of targeted resources.', 'https://attack.mitre.org/techniques/T1498'),
    ('T1486', 'Data Encrypted for Impact', 'Impact', 'Adversaries may encrypt data on target systems or on large numbers of systems in a network to interrupt availability.', 'https://attack.mitre.org/techniques/T1486'),
    ('T1059', 'Command and Scripting Interpreter', 'Execution', 'Adversaries may abuse command and script interpreters to execute commands, scripts, or binaries.', 'https://attack.mitre.org/techniques/T1059'),
    ('T1027', 'Obfuscated Files or Information', 'Defense Evasion', 'Adversaries may attempt to make an executable or file difficult to discover or analyze.', 'https://attack.mitre.org/techniques/T1027'),
    ('T1078', 'Valid Accounts', 'Defense Evasion', 'Adversaries may obtain and abuse credentials of existing accounts as a means of gaining Initial Access, Persistence, Privilege Escalation, or Defense Evasion.', 'https://attack.mitre.org/techniques/T1078'),
    ('T1133', 'External Remote Services', 'Persistence', 'Adversaries may leverage external-facing remote services to initially access a network.', 'https://attack.mitre.org/techniques/T1133'),
    ('T1046', 'Network Service Discovery', 'Discovery', 'Adversaries may attempt to get a listing of services running on remote hosts and local network infrastructure devices.', 'https://attack.mitre.org/techniques/T1046'),
    ('T1595', 'Active Scanning', 'Reconnaissance', 'Adversaries may execute active reconnaissance scans to gather information that can be used during targeting.', 'https://attack.mitre.org/techniques/T1595'),
    ('T1190', 'Exploit Public-Facing Application', 'Initial Access', 'Adversaries may attempt to exploit a weakness in an Internet-facing host or system to initially access a network.', 'https://attack.mitre.org/techniques/T1190'),
    ('T1021', 'Remote Services', 'Lateral Movement', 'Adversaries may use Valid Accounts to log into a service that accepts remote connections.', 'https://attack.mitre.org/techniques/T1021'),
    ('T1071', 'Application Layer Protocol', 'Command and Control', 'Adversaries may communicate using OSI application layer protocols to avoid detection.', 'https://attack.mitre.org/techniques/T1071'),
    ('T1053', 'Scheduled Task/Job', 'Execution', 'Adversaries may abuse task scheduling functionality to facilitate initial or recurring execution of malicious code.', 'https://attack.mitre.org/techniques/T1053'),
    ('T1547', 'Boot or Logon Autostart Execution', 'Persistence', 'Adversaries may configure system settings to automatically execute a program during system boot or logon.', 'https://attack.mitre.org/techniques/T1547'),
    ('T1562', 'Impair Defenses', 'Defense Evasion', 'Adversaries may maliciously modify components of a victim environment in order to hinder or disable defensive mechanisms.', 'https://attack.mitre.org/techniques/T1562');

-- Threat-to-MITRE mapping (many-to-many)
CREATE TABLE threat_mitre_mappings (
    threat_event_id VARCHAR(255) NOT NULL,
    technique_id VARCHAR(20) NOT NULL,
    confidence INT DEFAULT 50,
    mapped_at DATETIME,
    PRIMARY KEY (threat_event_id, technique_id),
    FOREIGN KEY (threat_event_id) REFERENCES threat_events(id),
    FOREIGN KEY (technique_id) REFERENCES mitre_techniques(id)
);

CREATE INDEX idx_threat_mitre_threat ON threat_mitre_mappings(threat_event_id);
CREATE INDEX idx_threat_mitre_technique ON threat_mitre_mappings(technique_id);

-- Asset Inventory / CMDB
CREATE TABLE assets (
    id VARCHAR(36) PRIMARY KEY,
    company_id VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    asset_type ENUM('SERVER', 'ENDPOINT', 'NETWORK_DEVICE', 'APPLICATION', 'DATABASE', 'CLOUD_RESOURCE', 'IOT_DEVICE') NOT NULL,
    ip_address VARCHAR(45),
    hostname VARCHAR(255),
    operating_system VARCHAR(255),
    criticality ENUM('CRITICAL', 'HIGH', 'MEDIUM', 'LOW') DEFAULT 'MEDIUM',
    owner VARCHAR(255),
    location VARCHAR(255),
    status ENUM('ACTIVE', 'INACTIVE', 'DECOMMISSIONED') DEFAULT 'ACTIVE',
    notes TEXT,
    created_at DATETIME,
    updated_at DATETIME,
    FOREIGN KEY (company_id) REFERENCES companies(id)
);

CREATE INDEX idx_assets_company ON assets(company_id);
CREATE INDEX idx_assets_type ON assets(asset_type);
CREATE INDEX idx_assets_criticality ON assets(criticality);
CREATE INDEX idx_assets_ip ON assets(ip_address);

-- Asset-Vulnerability linking
CREATE TABLE asset_vulnerabilities (
    asset_id VARCHAR(36) NOT NULL,
    vulnerability_id VARCHAR(255) NOT NULL,
    discovered_at DATETIME,
    PRIMARY KEY (asset_id, vulnerability_id),
    FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE,
    FOREIGN KEY (vulnerability_id) REFERENCES vulnerabilities(id)
);

CREATE INDEX idx_asset_vulns_asset ON asset_vulnerabilities(asset_id);
CREATE INDEX idx_asset_vulns_vuln ON asset_vulnerabilities(vulnerability_id);
