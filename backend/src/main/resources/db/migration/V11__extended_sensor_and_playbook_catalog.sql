-- V11: Extended sensor catalog + additional playbook templates

-- =====================================================
-- Additional Sensor Templates (5-12)
-- =====================================================

INSERT IGNORE INTO sensors (id, name, company_id, status, is_template, sensor_type, category, description, detected_threats, target_asset_types, icon, config_instructions, setup_command, registered_at)
VALUES (
    'TPL-SENSOR-005',
    'Suricata Bridge - Reenviador EVE JSON',
    'SYSTEM', 'template', TRUE, 'BRIDGE', 'NETWORK',
    'Componente puente que lee las alertas EVE JSON generadas por Suricata IDS y las reenvia al backend SOC en formato batch. Mapea automaticamente categorias de Suricata a tipos de amenaza SOC (PORT_SCAN, BRUTE_FORCE, MALWARE, C2, DOS, etc.) y calcula severidad en escala 1-10.',
    'PORT_SCAN,BRUTE_FORCE,MALWARE,C2,DOS,SQL_INJECTION,EXPLOIT,PRIVILEGE_ESCALATION,LATERAL_MOVEMENT,RECONNAISSANCE',
    'SERVER,NETWORK_DEVICE',
    'BRIDGE',
    '{"steps":["1. Se despliega automaticamente junto a Suricata","2. Lee /var/log/suricata/eve.json en tiempo real","3. Convierte alertas EVE al formato SOC","4. Envia batch cada 10 segundos"],"env_vars":["BRIDGE_BATCH_INTERVAL=10"],"requires":"Suricata IDS activo generando eve.json","docker_service":"suricata-bridge"}',
    'docker compose up -d suricata-bridge',
    NOW()
);

INSERT IGNORE INTO sensors (id, name, company_id, status, is_template, sensor_type, category, description, detected_threats, target_asset_types, icon, config_instructions, setup_command, registered_at)
VALUES (
    'TPL-SENSOR-006',
    'Network Flow Analyzer - Analisis de Flujo de Red',
    'SYSTEM', 'template', TRUE, 'NETFLOW', 'NETWORK',
    'Sensor de analisis de flujos de red basado en NetFlow/sFlow. Monitoriza patrones de trafico para detectar anomalias de volumen, comunicaciones C2 periodicas (beaconing), exfiltracion de datos por DNS tunneling, y movimiento lateral. Ideal para redes corporativas con switches gestionados.',
    'C2,DATA_EXFILTRATION,LATERAL_MOVEMENT,DDOS,RECONNAISSANCE,DNS_TUNNELING',
    'NETWORK_DEVICE,SERVER,CLOUD_RESOURCE',
    'NETWORK',
    '{"steps":["1. Configura NetFlow v9/IPFIX en tus switches y routers","2. Apunta el collector a la IP del servidor SOC","3. El sensor analiza flows buscando anomalias","4. Detecta beaconing C2, DNS tunneling y exfiltracion"],"env_vars":["COLLECTOR_PORT=2055","ANALYSIS_INTERVAL=60"],"requires":"Switches/routers con NetFlow habilitado","docker_service":"netflow-analyzer"}',
    'docker compose up -d netflow-analyzer',
    NOW()
);

INSERT IGNORE INTO sensors (id, name, company_id, status, is_template, sensor_type, category, description, detected_threats, target_asset_types, icon, config_instructions, setup_command, registered_at)
VALUES (
    'TPL-SENSOR-007',
    'File Integrity Monitor - Vigilancia de Integridad',
    'SYSTEM', 'template', TRUE, 'FIM', 'ENDPOINT',
    'Monitor de integridad de archivos criticos del sistema. Vigila cambios en /etc/passwd, /etc/shadow, binarios del sistema, configuraciones de servicio y ficheros web. Detecta modificaciones no autorizadas, rootkits, webshells y manipulacion de logs. Esencial para cumplimiento PCI-DSS y HIPAA.',
    'MALWARE,PRIVILEGE_ESCALATION,UNAUTHORIZED_ACCESS,ROOTKIT,WEBSHELL',
    'SERVER,ENDPOINT,APPLICATION',
    'AUTH',
    '{"steps":["1. Despliega el contenedor con acceso a los paths criticos","2. Configura los directorios a monitorizar","3. Establece baseline de hashes SHA-256","4. Alertas inmediatas ante cualquier cambio"],"env_vars":["WATCH_PATHS=/etc,/usr/bin,/var/www","CHECK_INTERVAL=30"],"requires":"Acceso de lectura a directorios criticos del host","docker_service":"fim-monitor"}',
    'docker compose up -d fim-monitor',
    NOW()
);

INSERT IGNORE INTO sensors (id, name, company_id, status, is_template, sensor_type, category, description, detected_threats, target_asset_types, icon, config_instructions, setup_command, registered_at)
VALUES (
    'TPL-SENSOR-008',
    'DNS Monitor - Vigilancia de Trafico DNS',
    'SYSTEM', 'template', TRUE, 'DNS_MONITOR', 'NETWORK',
    'Sensor pasivo de monitorizacion DNS. Captura y analiza consultas DNS para detectar dominios maliciosos (DGA), DNS tunneling para exfiltracion de datos, comunicaciones C2 encubiertas, y dominios de phishing. Integra con listas de dominios maliciosos conocidos.',
    'C2,DATA_EXFILTRATION,MALWARE,PHISHING,DNS_TUNNELING,RECONNAISSANCE',
    'SERVER,NETWORK_DEVICE,ENDPOINT',
    'NETWORK',
    '{"steps":["1. Captura trafico DNS del puerto 53","2. Analiza patrones de consultas sospechosas","3. Detecta dominios DGA con algoritmos ML","4. Cruza con feeds de dominios maliciosos"],"env_vars":["DNS_INTERFACE=enp1s0","MALICIOUS_FEEDS=true"],"requires":"Acceso al trafico DNS (puerto 53) de la red","docker_service":"dns-monitor"}',
    'docker compose up -d dns-monitor',
    NOW()
);

INSERT IGNORE INTO sensors (id, name, company_id, status, is_template, sensor_type, category, description, detected_threats, target_asset_types, icon, config_instructions, setup_command, registered_at)
VALUES (
    'TPL-SENSOR-009',
    'Windows Event Collector - Logs de Eventos Windows',
    'SYSTEM', 'template', TRUE, 'WINDOWS_LOG', 'ENDPOINT',
    'Recolector de eventos de seguridad de Windows via WinRM/WEF. Monitoriza Event IDs criticos: 4625 (login fallido), 4672 (privilegios especiales), 4720 (creacion usuario), 4688 (proceso nuevo), 7045 (servicio instalado). Detecta brute force RDP, escalada de privilegios y movimiento lateral.',
    'BRUTE_FORCE,PRIVILEGE_ESCALATION,LATERAL_MOVEMENT,UNAUTHORIZED_ACCESS,MALWARE',
    'ENDPOINT,SERVER',
    'AUTH',
    '{"steps":["1. Habilita WinRM en servidores Windows objetivo","2. Configura Windows Event Forwarding (WEF)","3. El sensor recolecta eventos de seguridad via WinRM","4. Analiza Event IDs criticos en tiempo real"],"env_vars":["WINRM_HOSTS=192.168.1.10,192.168.1.11","WINRM_USER=soc_reader"],"requires":"WinRM habilitado en servidores Windows, credenciales de lectura","docker_service":"windows-collector"}',
    'docker compose up -d windows-collector',
    NOW()
);

INSERT IGNORE INTO sensors (id, name, company_id, status, is_template, sensor_type, category, description, detected_threats, target_asset_types, icon, config_instructions, setup_command, registered_at)
VALUES (
    'TPL-SENSOR-010',
    'Email Security Gateway - Proteccion de Correo',
    'SYSTEM', 'template', TRUE, 'EMAIL_SECURITY', 'APPLICATION',
    'Sensor de seguridad de correo electronico. Analiza correos entrantes/salientes para detectar phishing, spear-phishing, BEC (Business Email Compromise), adjuntos maliciosos y URLs sospechosas. Integra con sandboxing de adjuntos y verificacion SPF/DKIM/DMARC.',
    'PHISHING,MALWARE,SOCIAL_ENGINEERING,BEC,SPAM',
    'APPLICATION,ENDPOINT,SERVER',
    'WEB',
    '{"steps":["1. Configura como relay SMTP o integra via API","2. Analiza headers, cuerpo y adjuntos de correos","3. Detecta phishing con ML y reglas heuristicas","4. Sandboxing automatico de adjuntos sospechosos"],"env_vars":["SMTP_RELAY_PORT=2525","SANDBOX_ENABLED=true"],"requires":"Acceso al flujo de correo SMTP o API del servidor de correo","docker_service":"email-gateway"}',
    'docker compose up -d email-gateway',
    NOW()
);

INSERT IGNORE INTO sensors (id, name, company_id, status, is_template, sensor_type, category, description, detected_threats, target_asset_types, icon, config_instructions, setup_command, registered_at)
VALUES (
    'TPL-SENSOR-011',
    'Cloud Security Monitor - CSPM Multi-Cloud',
    'SYSTEM', 'template', TRUE, 'CSPM', 'CLOUD',
    'Monitor de seguridad cloud multi-proveedor. Recolecta y analiza logs de CloudTrail (AWS), Activity Log (Azure) y Cloud Audit (GCP). Detecta misconfiguraciones, accesos no autorizados a S3/Blob, escalada de privilegios IAM, y despliegue de recursos sospechosos.',
    'UNAUTHORIZED_ACCESS,PRIVILEGE_ESCALATION,DATA_EXFILTRATION,MISCONFIGURATION,COMPLIANCE_VIOLATION',
    'CLOUD_RESOURCE,APPLICATION,DATABASE',
    'NETWORK',
    '{"steps":["1. Configura credenciales IAM con permisos de solo lectura","2. Habilita CloudTrail/Activity Log en tu cuenta cloud","3. El sensor recolecta eventos via API","4. Analiza en tiempo real contra reglas CIS Benchmark"],"env_vars":["AWS_ACCESS_KEY_ID=xxx","AWS_SECRET_ACCESS_KEY=xxx","AZURE_TENANT_ID=xxx"],"requires":"Credenciales IAM de solo lectura para AWS/Azure/GCP","docker_service":"cloud-monitor"}',
    'docker compose up -d cloud-monitor',
    NOW()
);

INSERT IGNORE INTO sensors (id, name, company_id, status, is_template, sensor_type, category, description, detected_threats, target_asset_types, icon, config_instructions, setup_command, registered_at)
VALUES (
    'TPL-SENSOR-012',
    'Vulnerability Scanner - Integracion OpenVAS/Nessus',
    'SYSTEM', 'template', TRUE, 'VULN_SCANNER', 'VULNERABILITY',
    'Integra resultados de escaners de vulnerabilidades (OpenVAS, Nessus, Qualys) en el SOC. Importa automaticamente CVEs descubiertos, asigna severidad CVSS, correlaciona con assets y genera incidentes para vulnerabilidades criticas. Programacion de escaneos periodicos.',
    'EXPLOIT,VULNERABILITY,MISCONFIGURATION,COMPLIANCE_VIOLATION',
    'SERVER,ENDPOINT,NETWORK_DEVICE,APPLICATION,DATABASE,CLOUD_RESOURCE,IOT_DEVICE',
    'HONEYPOT',
    '{"steps":["1. Conecta con tu instancia de OpenVAS/Nessus via API","2. Configura escaneos programados o importa resultados","3. CVEs se correlacionan automaticamente con assets","4. Vulnerabilidades criticas generan incidentes"],"env_vars":["SCANNER_TYPE=openvas","SCANNER_URL=https://openvas:9392","SCANNER_API_KEY=xxx"],"requires":"Instancia de OpenVAS/Nessus accesible via API","docker_service":"vuln-scanner"}',
    'docker compose up -d vuln-scanner',
    NOW()
);

-- =====================================================
-- Additional Playbook Templates (16-20)
-- =====================================================

INSERT IGNORE INTO playbooks (id, company_id, name, description, trigger_type, trigger_condition, is_active, is_template, category, mitre_techniques, target_asset_types, created_at, updated_at)
VALUES ('TPL-016', 'SYSTEM', 'Reconnaissance Response', 'Respuesta automatica a actividad de reconocimiento. Enriquece la IP del scanner, registra el incidente, notifica al equipo SOC y envia datos al SIEM para correlacion con otras actividades del mismo origen.', 'THREAT_TYPE', 'RECONNAISSANCE', TRUE, TRUE, 'RECONNAISSANCE', 'T1595,T1592,T1590', 'SERVER,NETWORK_DEVICE,APPLICATION,CLOUD_RESOURCE', NOW(), NOW());

INSERT IGNORE INTO playbook_steps (id, playbook_id, step_order, action_type, action_config, description, created_at) VALUES
('TPL-016-S1', 'TPL-016', 1, 'ENRICH_IP', '{"feeds":["abuseipdb","shodan"],"cache_hours":12}', 'Enrich scanner IP with intelligence', NOW()),
('TPL-016-S2', 'TPL-016', 2, 'CREATE_INCIDENT', '{"severity":"medium","title_prefix":"Reconnaissance Detected","description":"Network reconnaissance activity detected from external source"}', 'Create MEDIUM incident for tracking', NOW()),
('TPL-016-S3', 'TPL-016', 3, 'NOTIFY_SLACK', '{"channel":"#soc-alerts","message_template":"Reconnaissance activity detected. Scanner IP enriched. Monitor for escalation.","mention":"@soc-analysts"}', 'Notify SOC team', NOW()),
('TPL-016-S4', 'TPL-016', 4, 'WEBHOOK_CALL', '{"url":"${SIEM_WEBHOOK}","method":"POST","payload_template":"correlation_event"}', 'Send to SIEM for correlation', NOW());

INSERT IGNORE INTO playbooks (id, company_id, name, description, trigger_type, trigger_condition, is_active, is_template, category, mitre_techniques, target_asset_types, created_at, updated_at)
VALUES ('TPL-017', 'SYSTEM', 'DNS Tunneling Response', 'Respuesta a exfiltracion de datos via DNS tunneling. Bloquea inmediatamente la IP destino, crea incidente critico, activa monitoreo DLP adicional y notifica al equipo de respuesta a incidentes.', 'THREAT_TYPE', 'DNS_TUNNELING', TRUE, TRUE, 'DATA_EXFILTRATION', 'T1048,T1071.004', 'SERVER,ENDPOINT,NETWORK_DEVICE', NOW(), NOW());

INSERT IGNORE INTO playbook_steps (id, playbook_id, step_order, action_type, action_config, description, created_at) VALUES
('TPL-017-S1', 'TPL-017', 1, 'BLOCK_IP', '{"duration_hours":720,"reason":"DNS tunneling exfiltration detected - 30 day block"}', 'Block DNS tunnel destination', NOW()),
('TPL-017-S2', 'TPL-017', 2, 'CREATE_INCIDENT', '{"severity":"critical","title_prefix":"DNS Tunneling","description":"Data exfiltration via DNS tunneling detected"}', 'Create CRITICAL incident', NOW()),
('TPL-017-S3', 'TPL-017', 3, 'ENRICH_IP', '{"feeds":["abuseipdb","virustotal","otx"],"cache_hours":1}', 'Enrich destination IP', NOW()),
('TPL-017-S4', 'TPL-017', 4, 'SEND_ALERT', '{"channels":["email","sms"],"priority":"critical","template":"dns_tunneling"}', 'Send SMS alert', NOW()),
('TPL-017-S5', 'TPL-017', 5, 'NOTIFY_SLACK', '{"channel":"#incident-response","message_template":"CRITICAL: DNS tunneling detected. Destination blocked. Begin forensics.","mention":"@ir-team"}', 'Notify IR team', NOW());

INSERT IGNORE INTO playbooks (id, company_id, name, description, trigger_type, trigger_condition, is_active, is_template, category, mitre_techniques, target_asset_types, created_at, updated_at)
VALUES ('TPL-018', 'SYSTEM', 'XSS Attack Response', 'Respuesta a ataques Cross-Site Scripting. Bloquea IP del atacante, crea incidente, actualiza reglas WAF y notifica al equipo de seguridad de aplicaciones.', 'THREAT_TYPE', 'XSS', TRUE, TRUE, 'WEB_ATTACK', 'T1059.007,T1189', 'APPLICATION,SERVER,CLOUD_RESOURCE', NOW(), NOW());

INSERT IGNORE INTO playbook_steps (id, playbook_id, step_order, action_type, action_config, description, created_at) VALUES
('TPL-018-S1', 'TPL-018', 1, 'BLOCK_IP', '{"duration_hours":168,"reason":"XSS attack detected - 7 day block"}', 'Block attacker IP', NOW()),
('TPL-018-S2', 'TPL-018', 2, 'ENRICH_IP', '{"feeds":["abuseipdb"],"cache_hours":4}', 'Enrich attacker IP', NOW()),
('TPL-018-S3', 'TPL-018', 3, 'CREATE_INCIDENT', '{"severity":"high","title_prefix":"XSS Attack","description":"Cross-Site Scripting attack detected"}', 'Create HIGH incident', NOW()),
('TPL-018-S4', 'TPL-018', 4, 'WEBHOOK_CALL', '{"url":"${WAF_WEBHOOK}","method":"POST","payload_template":"waf_xss_rule"}', 'Update WAF rules', NOW()),
('TPL-018-S5', 'TPL-018', 5, 'SEND_ALERT', '{"channels":["email"],"priority":"high","template":"xss_attack"}', 'Alert AppSec team', NOW());

INSERT IGNORE INTO playbooks (id, company_id, name, description, trigger_type, trigger_condition, is_active, is_template, category, mitre_techniques, target_asset_types, created_at, updated_at)
VALUES ('TPL-019', 'SYSTEM', 'DoS Attack Response', 'Respuesta rapida a ataques de Denegacion de Servicio. Bloquea IP origen, crea incidente critico, activa proteccion upstream, enriquece inteligencia y notifica al equipo NOC.', 'THREAT_TYPE', 'DOS', TRUE, TRUE, 'DOS', 'T1498,T1499', 'SERVER,NETWORK_DEVICE,APPLICATION,CLOUD_RESOURCE', NOW(), NOW());

INSERT IGNORE INTO playbook_steps (id, playbook_id, step_order, action_type, action_config, description, created_at) VALUES
('TPL-019-S1', 'TPL-019', 1, 'BLOCK_IP', '{"duration_hours":48,"reason":"DoS attack source - 48 hour block"}', 'Block DoS source', NOW()),
('TPL-019-S2', 'TPL-019', 2, 'CREATE_INCIDENT', '{"severity":"critical","title_prefix":"DoS Attack","description":"Denial of Service attack detected"}', 'Create CRITICAL incident', NOW()),
('TPL-019-S3', 'TPL-019', 3, 'ENRICH_IP', '{"feeds":["abuseipdb","shodan"],"cache_hours":1}', 'Enrich attack source', NOW()),
('TPL-019-S4', 'TPL-019', 4, 'SEND_ALERT', '{"channels":["email","sms"],"priority":"critical","template":"dos_attack"}', 'Send critical alert', NOW()),
('TPL-019-S5', 'TPL-019', 5, 'NOTIFY_SLACK', '{"channel":"#noc-alerts","message_template":"DoS attack in progress. Source blocked. Monitor bandwidth.","mention":"@noc-team"}', 'Notify NOC', NOW());

INSERT IGNORE INTO playbooks (id, company_id, name, description, trigger_type, trigger_condition, is_active, is_template, category, mitre_techniques, target_asset_types, created_at, updated_at)
VALUES ('TPL-020', 'SYSTEM', 'Exploit Detection Response', 'Respuesta a deteccion de exploits activos. Bloquea inmediatamente el origen, crea incidente critico, enriquece IOCs, activa threat hunting y notifica al equipo IR.', 'THREAT_TYPE', 'EXPLOIT', TRUE, TRUE, 'EXPLOIT', 'T1190,T1203,T1210', 'SERVER,ENDPOINT,APPLICATION,DATABASE', NOW(), NOW());

INSERT IGNORE INTO playbook_steps (id, playbook_id, step_order, action_type, action_config, description, created_at) VALUES
('TPL-020-S1', 'TPL-020', 1, 'BLOCK_IP', '{"duration_hours":720,"reason":"Active exploit detected - 30 day block"}', 'Block exploit source for 30 days', NOW()),
('TPL-020-S2', 'TPL-020', 2, 'CREATE_INCIDENT', '{"severity":"critical","title_prefix":"Active Exploit","description":"Active exploitation attempt detected"}', 'Create CRITICAL incident', NOW()),
('TPL-020-S3', 'TPL-020', 3, 'ENRICH_IP', '{"feeds":["abuseipdb","virustotal","otx","shodan"],"cache_hours":1}', 'Enrich across all feeds', NOW()),
('TPL-020-S4', 'TPL-020', 4, 'SEND_ALERT', '{"channels":["email","sms"],"priority":"critical","template":"exploit_detected"}', 'Send critical SMS alert', NOW()),
('TPL-020-S5', 'TPL-020', 5, 'WEBHOOK_CALL', '{"url":"${SIEM_WEBHOOK}","method":"POST","payload_template":"threat_hunt"}', 'Initiate threat hunt', NOW()),
('TPL-020-S6', 'TPL-020', 6, 'NOTIFY_SLACK', '{"channel":"#incident-response","message_template":"CRITICAL: Active exploit detected. Source blocked 30d. Threat hunt initiated.","mention":"@ir-team"}', 'Notify IR team', NOW());
