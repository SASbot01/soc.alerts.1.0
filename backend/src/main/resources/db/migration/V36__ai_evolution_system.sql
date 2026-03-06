-- AI Incident Studies: deep analysis of each incident for learning
CREATE TABLE ai_incident_studies (
    id VARCHAR(36) PRIMARY KEY,
    company_id VARCHAR(255) NOT NULL,
    incident_id VARCHAR(36) NOT NULL,
    threat_event_id VARCHAR(36) NULL,

    study_type ENUM('DEEP_ANALYSIS','ROOT_CAUSE','PATTERN_DISCOVERY','DEFENSE_PROPOSAL') NOT NULL DEFAULT 'DEEP_ANALYSIS',
    status ENUM('PENDING','IN_PROGRESS','COMPLETED','FAILED') NOT NULL DEFAULT 'PENDING',

    -- Analysis fields
    root_cause TEXT NULL,
    attack_vector_analysis TEXT NULL,
    vulnerability_exploited TEXT NULL,
    attack_sophistication INT NULL,

    -- JSON fields
    defense_recommendations JSON NULL,
    similar_past_incidents JSON NULL,
    new_patterns_discovered JSON NULL,
    mitre_techniques_identified JSON NULL,

    -- Learning
    improvement_insights TEXT NULL,
    lessons_learned TEXT NULL,

    -- Metadata
    tokens_used INT DEFAULT 0,
    study_duration_ms BIGINT DEFAULT 0,
    error_message TEXT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME NULL,

    INDEX idx_studies_company (company_id),
    INDEX idx_studies_incident (incident_id),
    INDEX idx_studies_status (status),
    INDEX idx_studies_type (study_type),
    INDEX idx_studies_created (created_at),
    CONSTRAINT fk_studies_company FOREIGN KEY (company_id) REFERENCES companies(id),
    CONSTRAINT fk_studies_incident FOREIGN KEY (incident_id) REFERENCES incidents(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- AI Evolution Snapshots: periodic metrics tracking agent improvement
CREATE TABLE ai_evolution_snapshots (
    id VARCHAR(36) PRIMARY KEY,
    company_id VARCHAR(255) NOT NULL,
    snapshot_date DATE NOT NULL,
    period_type ENUM('DAILY','WEEKLY','MONTHLY') NOT NULL DEFAULT 'DAILY',

    -- Metrics
    total_incidents_studied INT DEFAULT 0,
    accuracy_score DOUBLE DEFAULT 0.0,
    false_positive_reduction_pct DOUBLE DEFAULT 0.0,
    new_patterns_count INT DEFAULT 0,
    defense_improvements_count INT DEFAULT 0,
    mean_response_time_ms BIGINT DEFAULT 0,
    mean_confidence_score DOUBLE DEFAULT 0.0,

    -- JSON aggregations
    top_attack_types JSON NULL,
    top_defenses_proposed JSON NULL,
    learning_milestones JSON NULL,

    -- AI narrative
    evolution_summary LONGTEXT NULL,
    areas_of_improvement TEXT NULL,
    areas_needing_attention TEXT NULL,

    -- Linking
    previous_snapshot_id VARCHAR(36) NULL,
    tokens_used INT DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_snapshots_company (company_id),
    INDEX idx_snapshots_date (snapshot_date),
    INDEX idx_snapshots_period (period_type),
    CONSTRAINT fk_snapshots_company FOREIGN KEY (company_id) REFERENCES companies(id),
    CONSTRAINT fk_snapshots_previous FOREIGN KEY (previous_snapshot_id) REFERENCES ai_evolution_snapshots(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
