-- V41: Fix company_id columns from BIGINT to VARCHAR(50) to match entity model types

ALTER TABLE normalized_logs MODIFY COLUMN company_id VARCHAR(50);
ALTER TABLE log_sources MODIFY COLUMN company_id VARCHAR(50);
ALTER TABLE ioc_entries MODIFY COLUMN company_id VARCHAR(50);
ALTER TABLE stix_feeds MODIFY COLUMN company_id VARCHAR(50);
ALTER TABLE compliance_frameworks MODIFY COLUMN company_id VARCHAR(50);
ALTER TABLE compliance_assessments MODIFY COLUMN company_id VARCHAR(50);
ALTER TABLE asm_domains MODIFY COLUMN company_id VARCHAR(50);
ALTER TABLE forensic_cases MODIFY COLUMN company_id VARCHAR(50);
ALTER TABLE cloud_accounts MODIFY COLUMN company_id VARCHAR(50);
ALTER TABLE identity_events MODIFY COLUMN company_id VARCHAR(50);
ALTER TABLE network_flows MODIFY COLUMN company_id VARCHAR(50);
ALTER TABLE honey_tokens MODIFY COLUMN company_id VARCHAR(50);
ALTER TABLE vuln_scans MODIFY COLUMN company_id VARCHAR(50);
ALTER TABLE cep_rules MODIFY COLUMN company_id VARCHAR(50);
ALTER TABLE ml_models MODIFY COLUMN company_id VARCHAR(50);
