-- V25: External integrations (ticketing + incident alerting)

CREATE TABLE integrations (
    id VARCHAR(36) PRIMARY KEY,
    company_id VARCHAR(36) NOT NULL,
    provider VARCHAR(50) NOT NULL COMMENT 'jira, servicenow, pagerduty, opsgenie',
    category VARCHAR(20) NOT NULL COMMENT 'ticketing, alerting',
    display_name VARCHAR(100) NOT NULL,
    config JSON NOT NULL COMMENT 'Encrypted config: base_url, api_key, project, etc.',
    is_active BOOLEAN DEFAULT FALSE,
    auto_create_tickets BOOLEAN DEFAULT FALSE,
    min_severity_ticket INT DEFAULT 5 COMMENT 'Min incident severity to auto-create ticket',
    auto_page BOOLEAN DEFAULT FALSE,
    min_severity_page INT DEFAULT 7 COMMENT 'Min incident severity to auto-page',
    last_sync_at DATETIME NULL,
    last_error VARCHAR(500) NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    INDEX idx_integrations_company (company_id),
    INDEX idx_integrations_provider (provider),
    UNIQUE KEY uk_company_provider (company_id, provider)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE integration_tickets (
    id VARCHAR(36) PRIMARY KEY,
    integration_id VARCHAR(36) NOT NULL,
    incident_id VARCHAR(36) NOT NULL,
    external_ticket_id VARCHAR(255) NOT NULL,
    external_ticket_url VARCHAR(500),
    status VARCHAR(50) DEFAULT 'open',
    synced_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (integration_id) REFERENCES integrations(id) ON DELETE CASCADE,
    FOREIGN KEY (incident_id) REFERENCES incidents(id) ON DELETE CASCADE,
    INDEX idx_tickets_incident (incident_id),
    INDEX idx_tickets_integration (integration_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE integration_pages (
    id VARCHAR(36) PRIMARY KEY,
    integration_id VARCHAR(36) NOT NULL,
    incident_id VARCHAR(36) NOT NULL,
    external_alert_id VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'triggered',
    paged_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (integration_id) REFERENCES integrations(id) ON DELETE CASCADE,
    FOREIGN KEY (incident_id) REFERENCES incidents(id) ON DELETE CASCADE,
    INDEX idx_pages_incident (incident_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
