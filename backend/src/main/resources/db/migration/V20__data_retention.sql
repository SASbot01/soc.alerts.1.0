-- =============================================
-- V20: Data Retention Logging
-- =============================================

-- Track retention job runs
CREATE TABLE IF NOT EXISTS data_retention_logs (
    id VARCHAR(36) PRIMARY KEY,
    company_id VARCHAR(36) NOT NULL,
    run_at DATETIME NOT NULL,
    retention_days INT NOT NULL,
    threats_deleted INT DEFAULT 0,
    alerts_deleted INT DEFAULT 0,
    activity_logs_deleted INT DEFAULT 0,
    status VARCHAR(20) DEFAULT 'completed',
    error_message TEXT,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Add index on timestamp columns for efficient retention queries (IF NOT EXISTS not supported for CREATE INDEX in MySQL 8.0, so use procedure)
SET @idx_exists = (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'threat_events' AND index_name = 'idx_threat_events_timestamp');
SET @sql = IF(@idx_exists = 0, 'CREATE INDEX idx_threat_events_timestamp ON threat_events(timestamp)', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @idx_exists = (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'alert_history' AND index_name = 'idx_alert_history_sent_at');
SET @sql = IF(@idx_exists = 0, 'CREATE INDEX idx_alert_history_sent_at ON alert_history(sent_at)', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
