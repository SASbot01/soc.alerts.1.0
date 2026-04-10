-- V40: Tier 1 / Tier 2 / Tier 3 Feature Tables
-- SIEM, Threat Intel, Compliance, ASM, Forensics, Cloud, Identity, Network, Deception, Vuln, CEP, ML

-- 1. SIEM log ingestion
CREATE TABLE normalized_logs (
    id           BIGINT AUTO_INCREMENT,
    company_id   BIGINT,
    source_type  VARCHAR(50),
    source_name  VARCHAR(100),
    timestamp    DATETIME(3),
    raw_data     LONGTEXT,
    parsed_data  JSON,
    severity     VARCHAR(20),
    category     VARCHAR(50),
    src_ip       VARCHAR(45),
    dst_ip       VARCHAR(45),
    src_port     INT,
    dst_port     INT,
    username     VARCHAR(100),
    hostname     VARCHAR(100),
    action       VARCHAR(50),
    outcome      VARCHAR(50),
    indexed_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    INDEX idx_nl_company_ts (company_id, timestamp),
    INDEX idx_nl_src        (src_ip),
    INDEX idx_nl_severity   (severity)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. Log sources
CREATE TABLE log_sources (
    id             BIGINT AUTO_INCREMENT,
    company_id     BIGINT,
    name           VARCHAR(100),
    source_type    VARCHAR(50)  COMMENT 'e.g. syslog/filebeat/api',
    config         JSON,
    enabled        BOOLEAN DEFAULT TRUE,
    last_event_at  DATETIME,
    events_today   BIGINT DEFAULT 0,
    created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. Threat intel IOCs
CREATE TABLE ioc_entries (
    id          BIGINT AUTO_INCREMENT,
    company_id  BIGINT,
    ioc_type    VARCHAR(30)  COMMENT 'e.g. ip/domain/hash/url',
    value       VARCHAR(500),
    source      VARCHAR(100),
    confidence  INT,
    severity    VARCHAR(20),
    tags        JSON,
    first_seen  DATETIME,
    last_seen   DATETIME,
    active      BOOLEAN DEFAULT TRUE,
    stix_id     VARCHAR(100),
    PRIMARY KEY (id),
    INDEX idx_ioc_value (value(100)),
    INDEX idx_ioc_type  (ioc_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. STIX / TAXII feeds
CREATE TABLE stix_feeds (
    id                BIGINT AUTO_INCREMENT,
    company_id        BIGINT,
    name              VARCHAR(100),
    url               VARCHAR(500),
    feed_type         VARCHAR(30),
    enabled           BOOLEAN DEFAULT TRUE,
    last_poll         DATETIME,
    poll_interval_min INT DEFAULT 60,
    ioc_count         INT DEFAULT 0,
    created_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 5. Compliance frameworks
CREATE TABLE compliance_frameworks (
    id              BIGINT AUTO_INCREMENT,
    company_id      BIGINT,
    name            VARCHAR(100),
    version         VARCHAR(20),
    description     TEXT,
    total_controls  INT DEFAULT 0,
    enabled         BOOLEAN DEFAULT TRUE,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 6. Compliance controls
CREATE TABLE compliance_controls (
    id           BIGINT AUTO_INCREMENT,
    framework_id BIGINT,
    control_id   VARCHAR(30),
    title        VARCHAR(200),
    description  TEXT,
    category     VARCHAR(100),
    severity     VARCHAR(20),
    PRIMARY KEY (id),
    FOREIGN KEY (framework_id) REFERENCES compliance_frameworks (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 7. Compliance assessments
CREATE TABLE compliance_assessments (
    id            BIGINT AUTO_INCREMENT,
    company_id    BIGINT,
    framework_id  BIGINT,
    started_at    DATETIME,
    completed_at  DATETIME,
    status        VARCHAR(20) DEFAULT 'pending',
    overall_score DECIMAL(5,2),
    passed        INT DEFAULT 0,
    failed        INT DEFAULT 0,
    na_count      INT DEFAULT 0,
    PRIMARY KEY (id),
    FOREIGN KEY (framework_id) REFERENCES compliance_frameworks (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 8. Compliance results
CREATE TABLE compliance_results (
    id            BIGINT AUTO_INCREMENT,
    assessment_id BIGINT,
    control_id    BIGINT,
    status        VARCHAR(20),
    evidence      TEXT,
    notes         TEXT,
    checked_at    DATETIME,
    PRIMARY KEY (id),
    FOREIGN KEY (assessment_id) REFERENCES compliance_assessments (id),
    FOREIGN KEY (control_id)    REFERENCES compliance_controls    (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 9. ASM domains
CREATE TABLE asm_domains (
    id                BIGINT AUTO_INCREMENT,
    company_id        BIGINT,
    domain            VARCHAR(255),
    discovered_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_scan         DATETIME,
    subdomains_count  INT DEFAULT 0,
    open_ports_count  INT DEFAULT 0,
    risk_score        INT DEFAULT 0,
    status            VARCHAR(20) DEFAULT 'active',
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 10. ASM discoveries
CREATE TABLE asm_discoveries (
    id             BIGINT AUTO_INCREMENT,
    domain_id      BIGINT,
    discovery_type VARCHAR(30)  COMMENT 'e.g. subdomain/port/cert/tech',
    value          VARCHAR(500),
    details        JSON,
    risk_level     VARCHAR(20),
    first_seen     DATETIME,
    last_seen      DATETIME,
    PRIMARY KEY (id),
    FOREIGN KEY (domain_id) REFERENCES asm_domains (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 11. Forensic cases
CREATE TABLE forensic_cases (
    id            BIGINT AUTO_INCREMENT,
    company_id    BIGINT,
    title         VARCHAR(200),
    description   TEXT,
    status        VARCHAR(20) DEFAULT 'open',
    severity      VARCHAR(20),
    lead_analyst  VARCHAR(100),
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
    closed_at     DATETIME,
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 12. Forensic evidence
CREATE TABLE forensic_evidence (
    id                BIGINT AUTO_INCREMENT,
    case_id           BIGINT,
    evidence_type     VARCHAR(50),
    name              VARCHAR(200),
    description       TEXT,
    file_path         VARCHAR(500),
    hash_sha256       VARCHAR(64),
    collected_at      DATETIME,
    collected_by      VARCHAR(100),
    chain_of_custody  JSON,
    PRIMARY KEY (id),
    FOREIGN KEY (case_id) REFERENCES forensic_cases (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 13. Forensic timeline
CREATE TABLE forensic_timeline (
    id          BIGINT AUTO_INCREMENT,
    case_id     BIGINT,
    timestamp   DATETIME(3),
    event_type  VARCHAR(50),
    description TEXT,
    source      VARCHAR(100),
    artifact    VARCHAR(200),
    PRIMARY KEY (id),
    INDEX idx_ft_case_ts (case_id, timestamp),
    FOREIGN KEY (case_id) REFERENCES forensic_cases (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 14. Cloud accounts
CREATE TABLE cloud_accounts (
    id             BIGINT AUTO_INCREMENT,
    company_id     BIGINT,
    provider       VARCHAR(20)  COMMENT 'e.g. aws/azure/gcp',
    account_id     VARCHAR(100),
    alias          VARCHAR(100),
    config         JSON,
    enabled        BOOLEAN DEFAULT TRUE,
    last_scan      DATETIME,
    findings_count INT DEFAULT 0,
    created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 15. Cloud findings
CREATE TABLE cloud_findings (
    id               BIGINT AUTO_INCREMENT,
    account_id       BIGINT,
    rule_id          VARCHAR(100),
    resource_type    VARCHAR(100),
    resource_id      VARCHAR(200),
    region           VARCHAR(50),
    severity         VARCHAR(20),
    title            VARCHAR(200),
    description      TEXT,
    remediation      TEXT,
    status           VARCHAR(20) DEFAULT 'open',
    found_at         DATETIME,
    resolved_at      DATETIME,
    PRIMARY KEY (id),
    FOREIGN KEY (account_id) REFERENCES cloud_accounts (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 16. Identity events
CREATE TABLE identity_events (
    id          BIGINT AUTO_INCREMENT,
    company_id  BIGINT,
    event_type  VARCHAR(50),
    username    VARCHAR(100),
    source_ip   VARCHAR(45),
    user_agent  VARCHAR(300),
    success     BOOLEAN,
    risk_score  INT DEFAULT 0,
    details     JSON,
    timestamp   DATETIME(3),
    PRIMARY KEY (id),
    INDEX idx_ie_company_ts (company_id, timestamp),
    INDEX idx_ie_user       (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 17. Network flows
CREATE TABLE network_flows (
    id          BIGINT AUTO_INCREMENT,
    company_id  BIGINT,
    src_ip      VARCHAR(45),
    dst_ip      VARCHAR(45),
    src_port    INT,
    dst_port    INT,
    protocol    VARCHAR(10),
    bytes_sent  BIGINT,
    bytes_recv  BIGINT,
    packets     INT,
    duration    DECIMAL(10,3),
    flags       VARCHAR(20),
    threat_type VARCHAR(50),
    timestamp   DATETIME(3),
    PRIMARY KEY (id),
    INDEX idx_nf_company_ts (company_id, timestamp)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 18. Honey tokens
CREATE TABLE honey_tokens (
    id          BIGINT AUTO_INCREMENT,
    company_id  BIGINT,
    token_type  VARCHAR(30)  COMMENT 'e.g. credential/file/url/dns',
    name        VARCHAR(100),
    value       VARCHAR(500),
    description TEXT,
    deployed_at DATETIME,
    active      BOOLEAN DEFAULT TRUE,
    hit_count   INT DEFAULT 0,
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 19. Honey events
CREATE TABLE honey_events (
    id         BIGINT AUTO_INCREMENT,
    token_id   BIGINT,
    source_ip  VARCHAR(45),
    user_agent VARCHAR(300),
    details    JSON,
    timestamp  DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    FOREIGN KEY (token_id) REFERENCES honey_tokens (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 20. Vulnerability scans
CREATE TABLE vuln_scans (
    id              BIGINT AUTO_INCREMENT,
    company_id      BIGINT,
    target          VARCHAR(200),
    scan_type       VARCHAR(30),
    status          VARCHAR(20) DEFAULT 'pending',
    started_at      DATETIME,
    completed_at    DATETIME,
    findings_count  INT DEFAULT 0,
    critical_count  INT DEFAULT 0,
    high_count      INT DEFAULT 0,
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 21. Vulnerability findings
CREATE TABLE vuln_findings (
    id                 BIGINT AUTO_INCREMENT,
    scan_id            BIGINT,
    cve_id             VARCHAR(20),
    title              VARCHAR(200),
    description        TEXT,
    severity           VARCHAR(20),
    cvss_score         DECIMAL(3,1),
    affected_component VARCHAR(200),
    remediation        TEXT,
    status             VARCHAR(20) DEFAULT 'open',
    found_at           DATETIME,
    PRIMARY KEY (id),
    FOREIGN KEY (scan_id) REFERENCES vuln_scans (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 22. CEP (Complex Event Processing) rules
CREATE TABLE cep_rules (
    id              BIGINT AUTO_INCREMENT,
    company_id      BIGINT,
    name            VARCHAR(100),
    description     TEXT,
    rule_type       VARCHAR(30),
    conditions      JSON,
    actions         JSON,
    window_seconds  INT DEFAULT 300,
    threshold       INT DEFAULT 1,
    enabled         BOOLEAN DEFAULT TRUE,
    hits            BIGINT DEFAULT 0,
    last_hit        DATETIME,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 23. CEP states
CREATE TABLE cep_states (
    id          BIGINT AUTO_INCREMENT,
    rule_id     BIGINT,
    state_key   VARCHAR(200),
    state_data  JSON,
    event_count INT DEFAULT 0,
    first_event DATETIME,
    last_event  DATETIME,
    expires_at  DATETIME,
    PRIMARY KEY (id),
    INDEX idx_cs_rule_key (rule_id, state_key),
    INDEX idx_cs_expires  (expires_at),
    FOREIGN KEY (rule_id) REFERENCES cep_rules (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 24. ML models
CREATE TABLE ml_models (
    id          BIGINT AUTO_INCREMENT,
    company_id  BIGINT,
    model_type  VARCHAR(50),
    name        VARCHAR(100),
    version     VARCHAR(20),
    config      JSON,
    metrics     JSON,
    status      VARCHAR(20) DEFAULT 'training',
    trained_at  DATETIME,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
