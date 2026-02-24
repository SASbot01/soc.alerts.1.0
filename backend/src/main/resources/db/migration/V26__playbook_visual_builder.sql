-- V26: Playbook visual builder — node positions, edges, conditional branching, parallel execution

ALTER TABLE playbook_steps
    ADD COLUMN position_x DOUBLE DEFAULT 0,
    ADD COLUMN position_y DOUBLE DEFAULT 0,
    ADD COLUMN node_type VARCHAR(50) DEFAULT 'action' COMMENT 'action, condition, trigger, end',
    ADD COLUMN condition_expression TEXT NULL COMMENT 'SpEL or JSON condition for branching',
    ADD COLUMN on_success_step_id VARCHAR(36) NULL,
    ADD COLUMN on_failure_step_id VARCHAR(36) NULL,
    ADD COLUMN is_parallel BOOLEAN DEFAULT FALSE;

CREATE TABLE playbook_edges (
    id VARCHAR(36) PRIMARY KEY,
    playbook_id VARCHAR(36) NOT NULL,
    source_step_id VARCHAR(36) NOT NULL,
    target_step_id VARCHAR(36) NOT NULL,
    edge_label VARCHAR(100) NULL COMMENT 'e.g. true, false, always',
    edge_type VARCHAR(30) DEFAULT 'default',
    condition_expression TEXT NULL COMMENT 'Condition that must be true to follow this edge',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (playbook_id) REFERENCES playbooks(id) ON DELETE CASCADE,
    INDEX idx_edges_playbook (playbook_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
