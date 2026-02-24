-- V31: UEBA — User and Entity Behavior Analytics

CREATE TABLE entity_behavior_profiles (
    id VARCHAR(36) PRIMARY KEY,
    company_id VARCHAR(36) NOT NULL,
    entity_type VARCHAR(30) NOT NULL COMMENT 'user, ip, asset, service',
    entity_id VARCHAR(200) NOT NULL,
    baseline_data JSON NULL COMMENT 'Statistical baseline: avg events/day, common hours, etc.',
    risk_score DOUBLE DEFAULT 0,
    total_events BIGINT DEFAULT 0,
    anomaly_count INT DEFAULT 0,
    last_activity_at DATETIME NULL,
    profile_updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    UNIQUE KEY uk_entity (company_id, entity_type, entity_id),
    INDEX idx_ueba_company (company_id),
    INDEX idx_ueba_risk (risk_score)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE behavior_anomalies (
    id VARCHAR(36) PRIMARY KEY,
    company_id VARCHAR(36) NOT NULL,
    profile_id VARCHAR(36) NOT NULL,
    anomaly_type VARCHAR(50) NOT NULL COMMENT 'unusual_time, volume_spike, new_destination, lateral_movement',
    anomaly_score DOUBLE NOT NULL,
    description TEXT NULL,
    event_data JSON NULL,
    is_reviewed BOOLEAN DEFAULT FALSE,
    reviewed_by VARCHAR(36) NULL,
    detected_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    FOREIGN KEY (profile_id) REFERENCES entity_behavior_profiles(id) ON DELETE CASCADE,
    INDEX idx_anomaly_company (company_id),
    INDEX idx_anomaly_profile (profile_id),
    INDEX idx_anomaly_score (anomaly_score)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
