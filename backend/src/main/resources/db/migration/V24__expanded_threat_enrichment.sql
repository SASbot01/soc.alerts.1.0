-- Expanded enrichment data from multiple providers
ALTER TABLE threat_enrichments
    ADD COLUMN virustotal_malicious INT DEFAULT 0,
    ADD COLUMN virustotal_suspicious INT DEFAULT 0,
    ADD COLUMN virustotal_harmless INT DEFAULT 0,
    ADD COLUMN greynoise_classification VARCHAR(50),
    ADD COLUMN greynoise_name VARCHAR(255),
    ADD COLUMN greynoise_noise BOOLEAN DEFAULT FALSE,
    ADD COLUMN greynoise_riot BOOLEAN DEFAULT FALSE,
    ADD COLUMN shodan_ports VARCHAR(500),
    ADD COLUMN shodan_os VARCHAR(255),
    ADD COLUMN shodan_vulns VARCHAR(1000),
    ADD COLUMN shodan_org VARCHAR(255),
    ADD COLUMN otx_pulse_count INT DEFAULT 0,
    ADD COLUMN otx_tags VARCHAR(500),
    ADD COLUMN enrichment_sources VARCHAR(255) DEFAULT 'abuseipdb';
