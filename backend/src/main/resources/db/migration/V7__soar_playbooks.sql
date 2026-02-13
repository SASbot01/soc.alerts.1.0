-- =============================================
-- V7: SOAR Playbooks - Automated Response Engine
-- =============================================

-- Playbook definitions
CREATE TABLE playbooks (
    id VARCHAR(36) PRIMARY KEY,
    company_id VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    trigger_type ENUM('THREAT_SEVERITY', 'THREAT_TYPE', 'INCIDENT_CREATED', 'MANUAL') NOT NULL,
    trigger_condition VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME,
    updated_at DATETIME,
    FOREIGN KEY (company_id) REFERENCES companies(id)
);

CREATE INDEX idx_playbooks_company ON playbooks(company_id);
CREATE INDEX idx_playbooks_trigger ON playbooks(trigger_type, is_active);

-- Playbook steps (ordered actions within a playbook)
CREATE TABLE playbook_steps (
    id VARCHAR(36) PRIMARY KEY,
    playbook_id VARCHAR(36) NOT NULL,
    step_order INT NOT NULL,
    action_type ENUM('BLOCK_IP', 'CREATE_INCIDENT', 'SEND_ALERT', 'ENRICH_IP', 'UPDATE_STATUS', 'NOTIFY_SLACK', 'WEBHOOK_CALL') NOT NULL,
    action_config TEXT,
    description VARCHAR(500),
    created_at DATETIME,
    FOREIGN KEY (playbook_id) REFERENCES playbooks(id) ON DELETE CASCADE
);

CREATE INDEX idx_playbook_steps_playbook ON playbook_steps(playbook_id);

-- Playbook execution records
CREATE TABLE playbook_executions (
    id VARCHAR(36) PRIMARY KEY,
    playbook_id VARCHAR(36) NOT NULL,
    company_id VARCHAR(255) NOT NULL,
    trigger_event_id VARCHAR(255),
    status ENUM('RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED') NOT NULL DEFAULT 'RUNNING',
    started_at DATETIME,
    completed_at DATETIME,
    error_message TEXT,
    FOREIGN KEY (playbook_id) REFERENCES playbooks(id),
    FOREIGN KEY (company_id) REFERENCES companies(id)
);

CREATE INDEX idx_playbook_exec_company ON playbook_executions(company_id);
CREATE INDEX idx_playbook_exec_playbook ON playbook_executions(playbook_id);
CREATE INDEX idx_playbook_exec_status ON playbook_executions(status);

-- Playbook execution step logs
CREATE TABLE playbook_execution_logs (
    id VARCHAR(36) PRIMARY KEY,
    execution_id VARCHAR(36) NOT NULL,
    step_id VARCHAR(36) NOT NULL,
    status ENUM('SUCCESS', 'FAILED', 'SKIPPED') NOT NULL,
    output TEXT,
    executed_at DATETIME,
    FOREIGN KEY (execution_id) REFERENCES playbook_executions(id) ON DELETE CASCADE,
    FOREIGN KEY (step_id) REFERENCES playbook_steps(id)
);

CREATE INDEX idx_playbook_logs_execution ON playbook_execution_logs(execution_id);
