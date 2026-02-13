-- V10: Sensor catalog templates + asset-sensor assignments

-- 1. Add template/catalog columns to sensors
ALTER TABLE sensors ADD COLUMN sensor_type VARCHAR(50);
ALTER TABLE sensors ADD COLUMN description TEXT;
ALTER TABLE sensors ADD COLUMN is_template BOOLEAN DEFAULT FALSE;
ALTER TABLE sensors ADD COLUMN source_template_id VARCHAR(255);
ALTER TABLE sensors ADD COLUMN detected_threats VARCHAR(500);
ALTER TABLE sensors ADD COLUMN target_asset_types VARCHAR(500);
ALTER TABLE sensors ADD COLUMN config_instructions TEXT;
ALTER TABLE sensors ADD COLUMN setup_command TEXT;
ALTER TABLE sensors ADD COLUMN icon VARCHAR(50);
ALTER TABLE sensors ADD COLUMN category VARCHAR(50);

-- 2. Create asset_sensor_assignments join table
CREATE TABLE IF NOT EXISTS asset_sensor_assignments (
    asset_id VARCHAR(36) NOT NULL,
    sensor_id VARCHAR(255) NOT NULL,
    assigned_at DATETIME NOT NULL,
    assigned_by VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    monitoring_config TEXT,
    PRIMARY KEY (asset_id, sensor_id),
    FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE,
    FOREIGN KEY (sensor_id) REFERENCES sensors(id) ON DELETE CASCADE
);

-- 3. Seed sensor catalog templates (owned by SYSTEM company)

-- Template 1: Suricata IDS - Network Intrusion Detection System
INSERT INTO sensors (id, name, company_id, status, is_template, sensor_type, category, description, detected_threats, target_asset_types, icon, config_instructions, setup_command, registered_at)
VALUES (
    'TPL-SENSOR-001',
    'Suricata IDS - Network Intrusion Detection',
    'SYSTEM',
    'template',
    TRUE,
    'NETWORK_IDS',
    'NETWORK',
    'Motor de deteccion de intrusiones de red en tiempo real. Captura y analiza todo el trafico de red usando reglas de deteccion basadas en patrones. Monitoriza protocolos HTTP, TLS, DNS, SSH, SMTP, FTP y SMB. Detecta escaneos de puertos, malware, ataques DoS, movimiento lateral, inyeccion SQL y exploits.',
    'PORT_SCAN,BRUTE_FORCE,MALWARE,C2,DDOS,SQL_INJECTION,EXPLOIT,LATERAL_MOVEMENT,PRIVILEGE_ESCALATION,RECONNAISSANCE',
    'SERVER,NETWORK_DEVICE,APPLICATION,DATABASE,CLOUD_RESOURCE',
    'NETWORK',
    '{"steps":["1. El contenedor Suricata se despliega automaticamente con docker-compose","2. Configura SURICATA_INTERFACE con tu interfaz de red (ej: eth0, enp1s0)","3. El bridge convierte las alertas EVE JSON al formato SOC","4. Los datos se envian automaticamente cada 10 segundos"],"env_vars":["SURICATA_INTERFACE=enp1s0","BRIDGE_BATCH_INTERVAL=10"],"requires":"Acceso a la interfaz de red del host (modo promiscuo)","docker_service":"suricata + suricata-bridge"}',
    'docker compose up -d suricata suricata-bridge',
    NOW()
);

-- Template 2: Auth Monitor - SSH & Authentication Monitor
INSERT INTO sensors (id, name, company_id, status, is_template, sensor_type, category, description, detected_threats, target_asset_types, icon, config_instructions, setup_command, registered_at)
VALUES (
    'TPL-SENSOR-002',
    'Auth Monitor - Vigilancia de Autenticacion SSH',
    'SYSTEM',
    'template',
    TRUE,
    'AUTH_MONITOR',
    'ENDPOINT',
    'Monitoriza /var/log/auth.log en tiempo real para detectar eventos de seguridad relacionados con autenticacion. Detecta fuerza bruta SSH, intentos de escalada de privilegios (sudo/su), accesos no autorizados y escaneos de reconocimiento SSH. Ideal para proteger servidores Linux/Unix.',
    'BRUTE_FORCE,PRIVILEGE_ESCALATION,UNAUTHORIZED_ACCESS,RECONNAISSANCE',
    'SERVER,ENDPOINT',
    'AUTH',
    '{"steps":["1. El contenedor se despliega con docker-compose","2. Monta /var/log/auth.log del host como volumen de solo lectura","3. Detecta automaticamente intentos fallidos de SSH, sudo y su","4. Envia alertas cada 10 segundos al SOC"],"env_vars":["BRIDGE_BATCH_INTERVAL=10"],"requires":"Acceso de lectura a /var/log/auth.log del sistema host","docker_service":"auth-monitor"}',
    'docker compose up -d auth-monitor',
    NOW()
);

-- Template 3: Honeypot - Sistema de Engano y Alerta Temprana
INSERT INTO sensors (id, name, company_id, status, is_template, sensor_type, category, description, detected_threats, target_asset_types, icon, config_instructions, setup_command, registered_at)
VALUES (
    'TPL-SENSOR-003',
    'Honeypot - Trampa de Deteccion de Atacantes',
    'SYSTEM',
    'template',
    TRUE,
    'HONEYPOT',
    'DECEPTION',
    'Expone servicios falsos de SSH (puerto 2222) y HTTP (puerto 8443) para detectar atacantes y escaneres. Cualquier conexion a estos puertos indica actividad maliciosa confirmada con alta severidad. Detecta fuerza bruta, escaneres conocidos (Nmap, Nikto, SQLMap, Metasploit, etc.), inyeccion SQL, XSS y traversal de directorios.',
    'BRUTE_FORCE,RECONNAISSANCE,SQL_INJECTION,XSS,EXPLOIT',
    'SERVER,NETWORK_DEVICE,APPLICATION',
    'HONEYPOT',
    '{"steps":["1. El contenedor se despliega con docker-compose","2. Expone puertos 2222 (SSH falso) y 8443 (HTTP falso)","3. Toda conexion a estos puertos se reporta como amenaza","4. Configura HOST_IP con la IP del servidor"],"env_vars":["HOST_IP=192.168.1.39"],"requires":"Puertos 2222 y 8443 abiertos en el firewall","docker_service":"honeypot","ports":["2222 (SSH honeypot)","8443 (HTTP honeypot)"]}',
    'docker compose up -d honeypot',
    NOW()
);

-- Template 4: Nginx WAF - Firewall de Aplicaciones Web
INSERT INTO sensors (id, name, company_id, status, is_template, sensor_type, category, description, detected_threats, target_asset_types, icon, config_instructions, setup_command, registered_at)
VALUES (
    'TPL-SENSOR-004',
    'Nginx WAF - Firewall de Aplicaciones Web',
    'SYSTEM',
    'template',
    TRUE,
    'WAF',
    'WEB',
    'Analiza logs de acceso Nginx en tiempo real para detectar ataques web. Detecta inyeccion SQL, XSS, traversal de directorios, fuerza bruta de directorios y mas de 100 escáneres conocidos. Identifica patrones de ataque en URLs, user-agents y codigos de respuesta.',
    'SQL_INJECTION,XSS,EXPLOIT,RECONNAISSANCE,BRUTE_FORCE',
    'APPLICATION,SERVER,CLOUD_RESOURCE',
    'WEB',
    '{"steps":["1. El contenedor se despliega con docker-compose","2. Monta los logs de Nginx como volumen de solo lectura","3. Analiza cada request buscando patrones de ataque","4. Detecta flood de 4xx como fuerza bruta de directorios"],"env_vars":["HOST_IP=192.168.1.39","SCAN_THRESHOLD=20"],"requires":"Acceso de lectura a los logs de acceso de Nginx","docker_service":"nginx-monitor"}',
    'docker compose up -d nginx-monitor',
    NOW()
);
