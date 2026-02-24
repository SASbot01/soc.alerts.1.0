-- =============================================
-- V21: API Keys (multi-key support per company)
-- =============================================

CREATE TABLE api_keys (
    id VARCHAR(36) PRIMARY KEY,
    company_id VARCHAR(36) NOT NULL,
    name VARCHAR(100) NOT NULL,
    key_prefix VARCHAR(8) NOT NULL,
    key_hash VARCHAR(128) NOT NULL,
    scopes VARCHAR(500) DEFAULT 'sensor:upload',
    is_active BOOLEAN DEFAULT TRUE,
    last_used_at DATETIME,
    expires_at DATETIME,
    created_by VARCHAR(36),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    UNIQUE KEY uk_key_hash (key_hash)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX idx_api_keys_company ON api_keys(company_id);
CREATE INDEX idx_api_keys_active ON api_keys(is_active);

-- Migrate existing api_key from companies to api_keys table
INSERT INTO api_keys (id, company_id, name, key_prefix, key_hash, scopes, is_active, created_at)
SELECT
    UUID(),
    id,
    'Default API Key',
    LEFT(api_key, 8),
    SHA2(api_key, 256),
    'sensor:upload',
    TRUE,
    COALESCE(registered_at, NOW())
FROM companies
WHERE api_key IS NOT NULL AND api_key != '';
