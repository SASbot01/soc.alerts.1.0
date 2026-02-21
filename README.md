# BlackWolf SOC - Plataforma de Operaciones de Seguridad

Sistema completo de ciberseguridad empresarial con deteccion de amenazas en tiempo real, IDS/IPS (Suricata), honeypots multi-protocolo, correlacion de ataques, respuesta automatizada (SOAR), analisis AI autonomo, mapeo MITRE ATT&CK, gestion de incidentes, auditorias, pentesting y reportes automaticos.

---

## Indice

1. [Arquitectura General](#arquitectura-general)
2. [Stack Tecnologico](#stack-tecnologico)
3. [Estructura del Proyecto](#estructura-del-proyecto)
4. [Servicios Docker](#servicios-docker)
5. [Como Funciona: Flujo Completo](#como-funciona-flujo-completo)
6. [Inteligencia Artificial](#inteligencia-artificial)
7. [Deteccion y Correlacion](#deteccion-y-correlacion)
8. [Sistema de Alertas](#sistema-de-alertas)
9. [Instalacion y Arranque](#instalacion-y-arranque)
10. [API Reference](#api-reference)
11. [Base de Datos](#base-de-datos)
12. [Seguridad y Autenticacion](#seguridad-y-autenticacion)

---

## Arquitectura General

```
                          +-------------------+
                          |   Navegador Web   |
                          |  (React + Vite)   |
                          +--------+----------+
                                   |
                                   | HTTPS (Cloudflare Tunnel)
                                   v
                          +--------+----------+
                          |      Nginx        |
                          |   (Reverse Proxy)  |
                          +--------+----------+
                                   |
                    +--------------+--------------+
                    |                              |
                    v                              v
          +---------+----------+        +---------+---------+
          | Spring Boot Backend|<--SSE--| React Frontend    |
          |    (Puerto 8080)   |        |   (Puerto 80)     |
          |                    |        +-------------------+
          | - REST API         |
          | - JWT Auth (HS512) |
          | - Flyway Migrations|
          | - AI Agent (Claude)|
          | - SOAR Engine      |
          | - SSE Real-time    |
          +---+------+--------+
              |      |
       +------+  +---+------+
       v         v           v
  +--------+ +--------+ +---------+
  | MySQL  | | MinIO  | | Claude  |
  |  8.0   | | (S3)   | |   API   |
  | :3306  | | :9000  | +---------+
  +--------+ +--------+

  +-----------+   +-------------+   +-----------+   +-------------+
  | Suricata  |-->| Suricata    |   |  Auth     |   |   Nginx     |
  |   IDS     |   |  Bridge     |   |  Monitor  |   |   Monitor   |
  | (host net)|   | (eve.json)  |   | (auth.log)|   | (access.log)|
  +-----------+   +------+------+   +-----+-----+   +------+------+
                         |                |                 |
                         +-------+--------+---------+-------+
                                 |                  |
                                 v                  v
                          +------+------+    +------+------+
                          |   Backend   |    |  Honeypot   |
                          | /api/upload |    | SSH,HTTP,FTP|
                          +-------------+    | TELNET,SMTP |
                                             | MySQL,RDP   |
                                             +-------------+
```

**Modelo multi-tenant**: Cada empresa (Company) tiene su propio espacio aislado. Todos los datos estan ligados a un `company_id`.

---

## Stack Tecnologico

### Backend
| Tecnologia | Version | Uso |
|---|---|---|
| Java | 21 | Lenguaje principal |
| Spring Boot | 3.2.3 | Framework web + DI |
| Spring Security | 6.x | Autenticacion/Autorizacion |
| Spring Data JPA | 3.2.x | Acceso a datos |
| Flyway | 9.22.3 | Migraciones (V1-V14) |
| MySQL | 8.0 | Base de datos relacional |
| JJWT | 0.11.5 | Tokens JWT (HS512) |
| MinIO | 8.5.7 | Almacenamiento de objetos |
| Claude API | Sonnet 4 | Analisis AI de amenazas |

### Frontend
| Tecnologia | Version | Uso |
|---|---|---|
| React | 19.x | UI framework |
| TypeScript | 5.x | Tipado estatico |
| Vite | 7.x | Build tool + dev server |
| Tailwind CSS | 4.x | Estilos utility-first |
| React Router | 7.x | Navegacion SPA |
| Axios | 1.x | Cliente HTTP |
| Recharts | 3.x | Graficos y charts |
| Framer Motion | 12.x | Animaciones |

### Infraestructura
| Tecnologia | Uso |
|---|---|
| Docker Compose | Orquestacion de 10 servicios |
| Suricata 7.0 | IDS/IPS en modo AF_PACKET |
| Nginx | Reverse proxy + WAF monitor |
| Cloudflare Tunnel | Acceso externo seguro |

---

## Estructura del Proyecto

```
soc-alertas/
|
|-- backend/
|   |-- src/main/java/com/blackwolf/backend/
|   |   |-- config/           # SecurityConfig, WebConfig, GlobalExceptionHandler
|   |   |-- controller/       # REST Controllers (10+)
|   |   |   |-- AiAgentController.java       # AI noise patterns, decisions, reports
|   |   |   |-- MitreController.java         # MITRE ATT&CK coverage & mappings
|   |   |   |-- ReportController.java        # PDF report generation
|   |   |   +-- ...
|   |   |-- dto/              # Data Transfer Objects
|   |   |-- model/            # Entidades JPA (20+)
|   |   |   |-- AiAgentReport.java           # Reportes AI scheduled
|   |   |   |-- AiDecision.java              # Decisiones autonomas AI
|   |   |   |-- AiNoisePattern.java          # Patrones de ruido aprendidos
|   |   |   |-- CorrelationEvent.java        # Eventos de correlacion
|   |   |   |-- CorrelationRule.java         # Reglas de correlacion
|   |   |   +-- ...
|   |   |-- repository/       # Repositorios Spring Data (18+)
|   |   |-- security/         # JWT Filter, Token Provider
|   |   |-- service/          # Logica de negocio (15+)
|   |   |   |-- AiAutonomousAgentService.java  # AI tiempo real
|   |   |   |-- AiThreatAnalystService.java    # AI reportes cada 6h
|   |   |   |-- AlertService.java              # Alertas multi-canal
|   |   |   |-- CorrelationService.java        # Motor de correlacion
|   |   |   |-- SensorService.java             # Ingestion de datos
|   |   |   |-- SseService.java                # Server-Sent Events
|   |   |   +-- ...
|   |   +-- BlackWolfApplication.java
|   |-- src/main/resources/
|   |   |-- application.yml
|   |   +-- db/migration/     # V1 a V14 (Flyway)
|   +-- pom.xml
|
|-- frontend/
|   |-- src/
|   |   |-- components/       # Componentes (12+)
|   |   |   |-- AiAgentConsole.tsx    # Consola AI en tiempo real
|   |   |   |-- ThreatMap.tsx         # Mapa de origenes de amenazas
|   |   |   +-- Layout.tsx            # Layout principal
|   |   |-- hooks/
|   |   |   +-- useSseEvents.ts       # Hook SSE tiempo real
|   |   |-- pages/             # Paginas (14+)
|   |   |   |-- Dashboard.tsx          # Panel principal
|   |   |   |-- MitreMatrix.tsx        # Matriz MITRE ATT&CK
|   |   |   |-- IncidentDetail.tsx     # Detalle de incidentes
|   |   |   +-- ...
|   |   |-- lib/               # api.ts, services.ts
|   |   +-- types/             # Interfaces TypeScript
|   +-- package.json
|
+-- deploy/
    |-- docker-compose.yml     # 10 servicios
    |-- .env.example           # Variables de entorno
    |-- Dockerfile.backend
    |-- Dockerfile.frontend
    |-- nginx.conf
    |-- suricata/
    |   |-- suricata.yaml      # Configuracion IDS
    |   |-- threshold.config   # Supresion de falsos positivos
    |   +-- scan-detect.rules  # Reglas custom de deteccion
    |-- suricata-bridge/       # eve.json -> Backend API
    |-- auth-monitor/          # /var/log/auth.log -> Backend
    |-- honeypot/              # Honeypot multi-protocolo
    +-- nginx-monitor/         # access.log -> Backend
```

---

## Servicios Docker

| Servicio | Puerto | Descripcion |
|---|---|---|
| **MySQL** | 3306 | Base de datos principal |
| **MinIO** | 9000, 9001 | Almacenamiento S3-compatible |
| **Backend** | 8081 | API Spring Boot |
| **Frontend** | 80 | React via Nginx |
| **Cloudflare Tunnel** | - | Acceso externo seguro |
| **Suricata** | host network | IDS/IPS en interfaz de red |
| **Suricata Bridge** | - | Parsea eve.json y envia al backend |
| **Auth Monitor** | - | Monitorea /var/log/auth.log |
| **Honeypot** | 2222, 8443, 2121, 2323, 2525, 13306, 13389 | SSH, HTTP, FTP, Telnet, SMTP, MySQL, RDP |
| **Nginx Monitor** | - | Monitorea access.log del frontend |

---

## Como Funciona: Flujo Completo

### Paso 1: Registro de la Empresa

```bash
POST /api/v1/auth/register
{
  "companyName": "Acme Corp",
  "domain": "acme.com",
  "contactEmail": "security@acme.com",
  "plan": "enterprise"
}
```

Se crea la empresa con un API Key unico, un usuario admin (password: `admin`) y se devuelve el `apiKey` para configurar los sensores.

### Paso 2: Despliegue de Sensores

Se instalan sensores en la red del cliente. Los datos fluyen automaticamente:

```
Suricata IDS ----> Suricata Bridge ----> Backend API /sensors/upload
Auth Monitor ----> Backend API /sensors/upload
Honeypot --------> Backend API /sensors/upload
Nginx Monitor ---> Backend API /sensors/upload
```

### Paso 3: Pipeline de Procesamiento de Amenazas

Cuando llega una amenaza al backend (`SensorService.processUpload`):

```
1. Validar API Key + Company
2. Actualizar sensor (status: online, contadores)
3. Para cada amenaza:
   |
   |-- Deduplicacion temporal (5 min ventana, max 3 dupes por IP+tipo)
   |     Si duplicado -> guardar como "suppressed", saltar pipeline
   |
   |-- Guardar ThreatEvent (status: "detected")
   |
   |-- CorrelationService.evaluateThreat()
   |     Evalua reglas: severity_threshold, same_ip_same_type,
   |     same_type_threshold, same_ip_multi_type, attack_chain
   |     Dedup: no crear incidentes duplicados en 15 min
   |
   |-- AlertService.fireAlertsForThreat()
   |     Per-company: email, slack, webhook (segun configuracion)
   |     Global Slack deshabilitado (solo reportes cada 6h)
   |
   |-- SseService.emitThreat()
   |     Actualiza dashboard en tiempo real via SSE
   |
   |-- PlaybookService.triggerForThreat()
   |     Ejecuta playbooks SOAR automatizados
   |
   |-- MitreService.autoMapThreat()
   |     Mapeo automatico a tecnicas MITRE ATT&CK
   |
   |-- ThreatIntelService.enrichIp()
   |     Enriquece IP (pais, ISP, abuse score, Tor, VPN)
   |
   |-- AiAutonomousAgentService.queueThreat()
   |     Analisis AI: inmediato si severity >= 8, batch si menor
   |
   |-- Auto-block si severity >= 7
        Bloquea IP por 24 horas
```

### Paso 4: Dashboard en Tiempo Real

El panel web recibe actualizaciones via Server-Sent Events (SSE):
- Nuevas amenazas
- Incidentes creados
- Cadenas de ataque detectadas
- Decisiones del agente AI
- Actualizaciones del dashboard

### Paso 5: Gestion de Incidentes

Los incidentes se crean automaticamente por:
- Reglas de correlacion (brute force, DDoS, multi-vector, attack chains)
- Agente AI autonomo (amenazas reales/criticas)

Cada incidente incluye:
- Timeline de acciones
- Mapeo MITRE ATT&CK
- Generacion de reportes PDF
- SLA con deadline

### Paso 6: Auditorias y Pentesting

Lifecycle de auditorias:
```
SCOPING -> SCANNING -> TESTING -> REPORTING -> DELIVERED
```

Lifecycle de pentests:
```
PLANNING -> RECONNAISSANCE -> EXPLOITATION -> POST_EXPLOITATION -> REPORTING -> DELIVERED
```

### Paso 7: Vulnerabilidades y Certificaciones

```
DETECTED -> CONFIRMED -> IN_REMEDIATION -> FIXED -> VERIFIED
```

Certificaciones: ISO 27001, SOC 2, PCI DSS, GDPR, HIPAA, NIST

---

## Inteligencia Artificial

### AI Threat Analyst (Reportes Programados)

- **Frecuencia**: Cada 6 horas (configurable via cron)
- **Analiza**: Ultimas 24 horas de datos SOC
- **Genera**: Reporte OFENSIVO (Red Team) + DEFENSIVO (Blue Team)
- **Envia**: Reportes consolidados a Slack
- **Aprende**: Compara con reportes anteriores para detectar tendencias

### AI Autonomous Agent (Tiempo Real)

- **Analisis inmediato**: Amenazas con severity >= 8
- **Analisis batch**: Cada 2 minutos para amenazas no criticas
- **Veredictos**: NOISE, FALSE_POSITIVE, LEGITIMATE_SCAN, SUSPICIOUS, REAL_ATTACK, CRITICAL_ATTACK
- **Acciones automaticas**:
  - NOISE/FALSE_POSITIVE: Marca como falso positivo, aprende patron de ruido
  - LEGITIMATE_SCAN: Resuelve automaticamente
  - SUSPICIOUS: Escala + crea incidente medio
  - REAL_ATTACK: Escala + incidente alto + bloquea IP 48h + playbooks
  - CRITICAL_ATTACK: Maximo nivel de respuesta + bloquea IP 7 dias

### Noise Learning

El agente AI aprende patrones de ruido automaticamente:
- Patron: IP + tipo de amenaza + puerto + descripcion
- Expiracion: 7 dias (para re-evaluacion)
- Administrable via API (activar/desactivar/eliminar)

---

## Deteccion y Correlacion

### Suricata IDS

Reglas custom de deteccion (`scan-detect.rules`):
- SYN/NULL/XMAS/FIN Scan
- Masscan, ZMap, Nmap (OS fingerprint, NSE scripts, version probes)
- ICMP Ping Sweep
- SSH Brute Force
- HTTP Scanner User-Agents (Nikto, Nuclei, SQLmap, WPScan, etc.)

### Supresion de Falsos Positivos (`threshold.config`)

- STUN/Tailscale heartbeats (SID 2016149-2016150)
- SSDP UPnP discovery (SID 2019102)
- Cloudflare Tunnel IPs (198.41.192.0/24)
- IP 79.117.241.86 whitelisted (trafico legitimo)
- DNS SID:2047122 rate-limited (1 alerta/IP/5min)
- DNS a resolvers legitimos suprimido (1.1.1.1, 8.8.8.8)

### Reglas de Correlacion

| Regla | Tipo | Umbral | Ventana | Incidente |
|---|---|---|---|---|
| Brute Force | same_ip_same_type | 5 eventos | 10 min | high |
| DDoS | same_type_threshold | 10 eventos | 5 min | critical |
| Multi-Vector Attack | same_ip_multi_type | 3 tipos | 15 min | critical |
| Critical Auto-Incident | severity_threshold | severity >= 9 | - | critical |
| Recon-to-Breach | attack_chain | PORT_SCAN -> BRUTE_FORCE -> UNAUTHORIZED_ACCESS | 60 min | critical |
| Scan-to-Exploit | attack_chain | PORT_SCAN -> EXPLOIT -> LATERAL_MOVEMENT | 120 min | critical |

### Deduplicacion

- **Amenazas**: Si ya existen 3+ eventos del mismo IP+tipo en 5 minutos, se guarda como "suppressed" sin disparar alertas
- **Correlacion**: Si una regla ya creo un incidente en los ultimos 15 minutos, no crea duplicados

---

## Sistema de Alertas

### Canales Disponibles

| Canal | Configuracion | Uso |
|---|---|---|
| **Email** | Per-company SMTP | Alertas por severidad |
| **Slack** (per-company) | Webhook por empresa | Alertas por severidad |
| **Webhook** | URL custom | Integracion externa |
| **Slack** (global) | Reportes cada 6h | Solo reportes AI consolidados |
| **SSE** | Automatico | Dashboard tiempo real |

### Politica de Notificaciones

- Las alertas individuales por Slack global estan **deshabilitadas** para reducir ruido
- Los reportes consolidados AI se envian cada **6 horas** con analisis completo
- Las alertas per-company respetan el umbral de severidad minima configurado (default: 7)
- El auto-bloqueo de IPs se activa en severity >= 7

---

## Instalacion y Arranque

### Prerequisitos

- Docker y Docker Compose
- (Opcional) Java 21, Maven, Node.js 20+ para desarrollo local

### Despliegue Completo

```bash
cd deploy
cp .env.example .env
# Editar .env con tus valores (JWT_SECRET, API keys, etc.)
docker compose up -d --build
```

### Variables de Entorno Principales

| Variable | Descripcion | Default |
|---|---|---|
| `JWT_SECRET` | Clave secreta JWT (min 64 chars) | **Requerido** |
| `GLOBAL_SLACK_WEBHOOK` | Webhook Slack global | - |
| `GLOBAL_SLACK_ENABLED` | Habilitar Slack global | true |
| `CLAUDE_API_KEY` | API Key de Anthropic | - |
| `CLAUDE_ENABLED` | Habilitar chat AI | false |
| `AI_AGENT_ENABLED` | Reportes AI cada 6h | false |
| `AI_AGENT_SLACK_WEBHOOK` | Webhook para reportes AI | - |
| `AI_AGENT_SLACK_ENABLED` | Enviar reportes a Slack | false |
| `AI_AGENT_CRON` | Cron de reportes | `0 0 */6 * * *` |
| `AI_AUTONOMOUS_ENABLED` | Agente AI autonomo | false |
| `AI_AUTONOMOUS_AUTO_BLOCK` | Auto-bloqueo por AI | true |
| `AI_AUTONOMOUS_NOISE_LEARNING` | Aprender patrones de ruido | true |
| `SURICATA_INTERFACE` | Interfaz de red para Suricata | enp1s0 |
| `SOC_API_KEY` | API Key de la empresa | **Requerido** |
| `SOC_COMPANY_ID` | UUID de la empresa | **Requerido** |
| `ABUSEIPDB_API_KEY` | API Key AbuseIPDB | - |

### Desarrollo Local

```bash
# Backend
cd backend
MYSQL_DATABASE=blackwolf MYSQL_PASSWORD=admin mvn spring-boot:run

# Frontend
cd frontend
npm install && npm run dev
```

### Primer Uso

```bash
# Registrar empresa
curl -X POST http://localhost:8080/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"companyName":"Mi Empresa","domain":"miempresa.com","contactEmail":"admin@miempresa.com","plan":"enterprise"}'

# Login: http://localhost:5173
# Domain: miempresa.com | Email: admin@miempresa.com | Password: admin
```

---

## API Reference

### Autenticacion
| Metodo | Endpoint | Auth | Descripcion |
|---|---|---|---|
| POST | `/api/v1/auth/register` | No | Registrar empresa + admin |
| POST | `/api/v1/auth/login` | No | Login, devuelve JWT |

### Dashboard
| Metodo | Endpoint | Auth | Descripcion |
|---|---|---|---|
| GET | `/api/v1/dashboard/overview` | JWT | Estadisticas generales |

### Sensores
| Metodo | Endpoint | Auth | Descripcion |
|---|---|---|---|
| POST | `/api/v1/sensors/upload` | API Key | Envio de datos del sensor |
| GET | `/api/v1/sensors` | JWT | Listar sensores |
| GET | `/api/v1/sensors/catalog` | JWT | Catalogo de templates |
| POST | `/api/v1/sensors/deploy` | JWT | Desplegar desde catalogo |
| POST | `/api/v1/sensors/assign` | JWT | Asignar sensor a activo |

### Amenazas
| Metodo | Endpoint | Auth | Descripcion |
|---|---|---|---|
| GET | `/api/v1/threats` | JWT | Listar con filtros y paginacion |
| PATCH | `/api/v1/threats/{id}/status` | JWT | Cambiar estado |
| GET | `/api/v1/threats/map-origins` | JWT | Origenes para mapa geolocalizado |

### Incidentes
| Metodo | Endpoint | Auth | Descripcion |
|---|---|---|---|
| GET | `/api/v1/incidents` | JWT | Listar incidentes |
| GET | `/api/v1/incidents/{id}` | JWT | Detalle con timeline |
| POST | `/api/v1/incidents/{id}/timeline` | JWT | Agregar entrada al timeline |
| PATCH | `/api/v1/incidents/{id}/status` | JWT | Cambiar estado |
| PATCH | `/api/v1/incidents/{id}/assign` | JWT | Asignar analista |

### Alertas
| Metodo | Endpoint | Auth | Descripcion |
|---|---|---|---|
| GET | `/api/v1/alerts/configs` | JWT | Listar configuraciones |
| POST | `/api/v1/alerts/configs` | JWT | Crear configuracion (email/slack/webhook) |
| PUT | `/api/v1/alerts/configs/{id}` | JWT | Actualizar configuracion |
| GET | `/api/v1/alerts/history` | JWT | Historial de alertas enviadas |

### MITRE ATT&CK
| Metodo | Endpoint | Auth | Descripcion |
|---|---|---|---|
| GET | `/api/v1/mitre/techniques` | JWT | Listar tecnicas |
| POST | `/api/v1/mitre/map` | JWT | Mapear amenaza a tecnica |
| GET | `/api/v1/mitre/coverage` | JWT | Cobertura de deteccion |
| GET | `/api/v1/mitre/incident/{id}/mappings` | JWT | Mappings de un incidente |

### AI Agent
| Metodo | Endpoint | Auth | Descripcion |
|---|---|---|---|
| GET | `/api/v1/ai-agent/reports` | JWT | Listar reportes AI |
| POST | `/api/v1/ai-agent/analyze` | JWT | Forzar analisis manual |
| GET | `/api/v1/ai-agent/autonomous/stats` | JWT | Estadisticas del agente |
| GET | `/api/v1/ai-agent/autonomous/decisions` | JWT | Listar decisiones AI |
| GET | `/api/v1/ai-agent/autonomous/noise-patterns` | JWT | Patrones de ruido |

### Reportes
| Metodo | Endpoint | Auth | Descripcion |
|---|---|---|---|
| GET | `/api/v1/reports/executive` | JWT | Reporte ejecutivo PDF |
| GET | `/api/v1/reports/incident/{id}` | JWT | Reporte de incidente PDF |

### SSE (Tiempo Real)
| Metodo | Endpoint | Auth | Descripcion |
|---|---|---|---|
| GET | `/api/v1/sse/subscribe` | JWT | Stream de eventos en tiempo real |

### Playbooks (SOAR)
| Metodo | Endpoint | Auth | Descripcion |
|---|---|---|---|
| GET | `/api/v1/playbooks` | JWT | Listar playbooks |
| GET | `/api/v1/playbooks/catalog` | JWT | Catalogo de templates |
| POST | `/api/v1/playbooks/deploy` | JWT | Desplegar playbook |
| GET | `/api/v1/playbooks/executions` | JWT | Historial de ejecuciones |

### Auditorias, Pentests, Vulnerabilidades, Certificaciones

Mismos endpoints documentados con lifecycle completo de estados.

---

## Base de Datos

### Migraciones Flyway (V1-V14)

| Migracion | Contenido |
|---|---|
| V1 | Tablas base: companies, users, sensors, threat_events, blocked_ips |
| V2 | SOC: auditorias, pentests, vulnerabilidades, certificaciones, metricas |
| V3 | Super admin, roles de usuario |
| V4 | Incidentes, alertas, onboarding, correlation_rules, threat_enrichments |
| V5-V8 | Assets, playbooks, MITRE ATT&CK techniques |
| V9-V11 | Catalogo sensores (12), catalogo playbooks (20) |
| V12 | ai_agent_reports (reportes AI programados) |
| V13 | ai_decisions, ai_noise_patterns (agente autonomo) |
| V14 | correlation_events, attack chain rules |

### Tablas Principales

- `companies` - Empresas con API Key
- `users` - Usuarios con roles
- `sensors` - Sensores desplegados + catalogo de templates
- `threat_events` - Eventos de amenaza detectados
- `blocked_ips` - IPs bloqueadas (auto-expiran)
- `incidents` - Incidentes con SLA
- `incident_timeline` - Timeline de acciones
- `correlation_rules` - Reglas de correlacion (6 tipos)
- `correlation_events` - Log de matches de correlacion
- `alert_configurations` - Configs de alertas per-company
- `alert_history` - Historial de alertas enviadas
- `threat_enrichments` - Cache de inteligencia IP
- `ai_agent_reports` - Reportes AI ofensivos/defensivos
- `ai_decisions` - Decisiones autonomas del AI
- `ai_noise_patterns` - Patrones de ruido aprendidos
- `playbooks` - Playbooks SOAR + catalogo
- `playbook_executions` - Ejecuciones de playbooks
- `mitre_techniques` - Tecnicas MITRE ATT&CK
- `threat_mitre_mappings` - Mapeo amenazas-tecnicas

---

## Seguridad y Autenticacion

### JWT (JSON Web Tokens)
- **Algoritmo**: HS512 (HMAC-SHA512)
- **Access Token**: 15 minutos (configurable)
- **Refresh Token**: 7 dias
- **Cookie**: Secure + HttpOnly (produccion)

### Flujo de Autenticacion
```
1. POST /auth/login -> Valida credenciales -> Genera JWT + Refresh Token
2. Frontend guarda token, Axios interceptor agrega "Bearer token"
3. JwtAuthenticationFilter valida en cada request
4. AuthUtils extrae companyId para aislamiento multi-tenant
5. Token expirado -> 401 -> Refresh automatico o redirect a login
```

### API Key para Sensores
- Cada empresa tiene un API Key unico
- `/sensors/upload` es publico pero requiere API Key valida
- Se valida `company_id` del payload con la empresa del API Key

### Aislamiento Multi-tenant
- Todas las queries filtran por `companyId` del usuario autenticado
- Acceso a datos de otra empresa = HTTP 403

### CORS
- Origenes: configurable via `CORS_ALLOWED_ORIGINS`
- Default: `http://localhost:5173, http://localhost:80`

### Monitoring
- Actuator endpoints: health, info, metrics, prometheus
- Health details: when_authorized
