-- AI Threat Analyst Agent Reports
CREATE TABLE IF NOT EXISTS ai_agent_reports (
    id VARCHAR(36) PRIMARY KEY,
    company_id VARCHAR(36) NOT NULL,
    report_type VARCHAR(20) NOT NULL COMMENT 'OFFENSIVE or DEFENSIVE',
    title VARCHAR(255) NOT NULL,
    content LONGTEXT,
    summary TEXT,
    threats_analyzed INT DEFAULT 0,
    incidents_analyzed INT DEFAULT 0,
    period_start DATETIME,
    period_end DATETIME,
    tokens_used INT DEFAULT 0,
    slack_sent BOOLEAN DEFAULT FALSE,
    status VARCHAR(20) NOT NULL DEFAULT 'IN_PROGRESS' COMMENT 'IN_PROGRESS, COMPLETED, FAILED',
    error_message TEXT,
    previous_report_id VARCHAR(36),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_ai_reports_company (company_id),
    INDEX idx_ai_reports_type (company_id, report_type),
    INDEX idx_ai_reports_status (company_id, status),
    CONSTRAINT fk_ai_reports_company FOREIGN KEY (company_id) REFERENCES companies(id),
    CONSTRAINT fk_ai_reports_previous FOREIGN KEY (previous_report_id) REFERENCES ai_agent_reports(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
