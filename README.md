# BlackWolf SOC - Plataforma de Operaciones de Seguridad

Sistema completo de ciberseguridad empresarial con deteccion de amenazas en tiempo real, IDS/IPS (Suricata), honeypots multi-protocolo, correlacion de ataques, respuesta automatizada (SOAR), analisis AI autonomo con aprendizaje de ruido, mapeo MITRE ATT&CK, gestion de incidentes, UEBA, Sigma Rules, Threat Hunting, integraciones SIEM/SOAR, marketplace de plugins, billing con Stripe, auto-provisioning self-service, bot de prospeccion LinkedIn+Google+Email, y app de escritorio (Electron).

---

## Indice

1. [Arquitectura General](#arquitectura-general)
2. [Stack Tecnologico](#stack-tecnologico)
3. [Estructura del Proyecto](#estructura-del-proyecto)
4. [Servicios Docker](#servicios-docker)
5. [Como Funciona: Flujo Completo](#como-funciona-flujo-completo)
6. [Auto-Provisioning (Self-Service)](#auto-provisioning-self-service)
7. [Inteligencia Artificial](#inteligencia-artificial)
8. [Deteccion y Correlacion](#deteccion-y-correlacion)
9. [Sistema de Alertas](#sistema-de-alertas)
10. [LinkedIn Prospector Bot](#linkedin-prospector-bot)
11. [Funcionalidades Avanzadas](#funcionalidades-avanzadas)
12. [Instalacion y Arranque](#instalacion-y-arranque)
13. [API Reference](#api-reference)
14. [Base de Datos](#base-de-datos)
15. [Seguridad y Autenticacion](#seguridad-y-autenticacion)

---

## Arquitectura General

```
                          +-------------------+
                          |   Navegador Web   |       +------------------+
                          |  (React + Vite)   |       | Electron Desktop |
                          +--------+----------+       +--------+---------+
                                   |                           |
                                   | HTTPS (Cloudflare Tunnel) |
                                   v                           v
                          +--------+---------------------------+--+
                          |             Nginx (Reverse Proxy)     |
                          +--------+----------+-------------------+
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
          | - Stripe Billing   |
          | - Email Sequences  |
          +---+------+--------+
              |      |     \
       +------+ +---++  +--+------+  +---------+  +----------+
       v        v       v          v             v
  +--------+ +----+ +-------+ +--------+ +---------+ +--------+
  | MySQL  | |MinIO| |Claude | | Redis  | | Elastic | | Stripe |
  |  8.0   | |(S3) | | API  | | 7-alp  | | Search  | |  API   |
  | :3306  | |:9000| +------+ | :6379  | | :9200   | +--------+
  +--------+ +----+           +--------+ +---------+

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
  +---------------------+                   +-------------+
  | LinkedIn Prospector  |
  | (Python + FastAPI)   |-----> Backend /prospects/from-bot
  | Search + Google Email|
  | Connection Requests  |
  +---------------------+
```

**Modelo multi-tenant**: Cada empresa (Company) tiene su propio espacio aislado. Todos los datos estan ligados a un `company_id`.

---

## Stack Tecnologico

### Backend
| Tecnologia | Version | Uso |
|---|---|---|
| Java | 21 | Lenguaje principal |
| Spring Boot | 3.2.3 | Framework web + DI |
| Spring Security | 6.x | Autenticacion/Autorizacion + MFA (TOTP) |
| Spring Data JPA | 3.2.x | Acceso a datos |
| Flyway | 9.22.3 | Migraciones (V1-V34) |
| MySQL | 8.0 | Base de datos relacional |
| Redis | 7 | Rate limiting, cache, sesiones |
| Elasticsearch | 8.12 | Indexacion de amenazas, busqueda full-text |
| JJWT | 0.11.5 | Tokens JWT (HS512) |
| MinIO | 8.5.7 | Almacenamiento de objetos |
| Claude API | Sonnet 4 | Analisis AI de amenazas + AI Cortex |
| Stripe API | - | Billing, suscripciones, auto-provisioning |

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

### LinkedIn Prospector (Python)
| Tecnologia | Uso |
|---|---|
| Python 3.11 | Lenguaje |
| FastAPI + Uvicorn | API de gestion |
| linkedin-api | Busqueda y conexiones LinkedIn |
| APScheduler | Jobs programados |
| BeautifulSoup4 | Scraping Google para emails |
| dnspython | Verificacion SMTP de emails |

### Desktop (Electron)
| Tecnologia | Uso |
|---|---|
| Electron | App de escritorio multiplataforma |
| Node.js | Runtime |

### Infraestructura
| Tecnologia | Uso |
|---|---|
| Docker Compose | Orquestacion de 14 servicios (restart: always) |
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
|   |   |-- config/           # SecurityConfig, WebConfig, Redis, Elasticsearch, Stripe
|   |   |-- controller/       # REST Controllers (20+)
|   |   |   |-- AiAgentController.java       # AI noise patterns, decisions, reports
|   |   |   |-- BillingController.java       # Stripe billing, suscripciones
|   |   |   |-- IntegrationController.java   # SIEM/SOAR integrations
|   |   |   |-- MarketplaceController.java   # Plugin marketplace
|   |   |   |-- MfaController.java           # Multi-factor authentication
|   |   |   |-- ProspectController.java      # Leads from LinkedIn bot
|   |   |   |-- RoleController.java          # RBAC roles/permissions
|   |   |   |-- SigmaController.java         # Sigma detection rules
|   |   |   |-- ThreatHuntingController.java # Threat hunting queries
|   |   |   |-- UebaController.java          # User behavior analytics
|   |   |   +-- ...
|   |   |-- dto/              # Data Transfer Objects
|   |   |-- elasticsearch/    # Threat indexing and full-text search
|   |   |-- model/            # Entidades JPA (40+)
|   |   |-- repository/       # Repositorios Spring Data (35+)
|   |   |-- security/         # JWT Filter, Token Provider, PermissionChecker
|   |   |-- service/          # Logica de negocio (30+)
|   |   |   |-- AiAutonomousAgentService.java  # AI tiempo real
|   |   |   |-- AiThreatAnalystService.java    # AI reportes cada 6h
|   |   |   |-- AlertService.java              # Alertas multi-canal
|   |   |   |-- BillingService.java            # Stripe checkout + auto-provisioning
|   |   |   |-- CorrelationService.java        # Motor de correlacion
|   |   |   |-- EmailSequenceService.java      # Email drip campaigns
|   |   |   |-- IntegrationService.java        # SIEM/SOAR integrations
|   |   |   |-- MarketplaceService.java        # Plugin marketplace
|   |   |   |-- MfaService.java                # TOTP multi-factor auth
|   |   |   |-- RbacService.java               # Role-based access control
|   |   |   |-- SalesOutreachBot.java          # 4-email cold outreach sequence
|   |   |   |-- SigmaRuleService.java          # Sigma detection rules
|   |   |   |-- SensorService.java             # Ingestion de datos
|   |   |   |-- SseService.java                # Server-Sent Events
|   |   |   |-- ThreatHuntingService.java      # Threat hunting
|   |   |   |-- UebaService.java               # User/entity behavior analytics
|   |   |   |-- ai/                            # AI Cortex (learning, performance)
|   |   |   |-- cloudlogs/                     # AWS/Azure/GCP log ingestion
|   |   |   |-- threatintel/                   # Threat intelligence feeds
|   |   |   +-- ...
|   |   +-- BlackWolfApplication.java
|   |-- src/main/resources/
|   |   |-- application.yml
|   |   +-- db/migration/     # V1 a V34 (Flyway)
|   +-- pom.xml
|
|-- frontend/
|   |-- src/
|   |   |-- components/       # Componentes (15+)
|   |   |   |-- AiAgentConsole.tsx    # Consola AI en tiempo real
|   |   |   |-- ThreatMap.tsx         # Mapa de origenes de amenazas
|   |   |   |-- MfaSetup.tsx          # Configuracion MFA
|   |   |   |-- ThreatEnrichmentPanel.tsx # Panel de enriquecimiento IP
|   |   |   +-- Layout.tsx            # Layout principal
|   |   |-- hooks/
|   |   |   +-- useSseEvents.ts       # Hook SSE tiempo real
|   |   |-- pages/             # Paginas (20+)
|   |   |   |-- Dashboard.tsx          # Panel principal
|   |   |   |-- MitreMatrix.tsx        # Matriz MITRE ATT&CK
|   |   |   |-- IncidentDetail.tsx     # Detalle de incidentes
|   |   |   |-- Billing.tsx            # Gestion de suscripcion
|   |   |   |-- Pricing.tsx            # Pagina de precios
|   |   |   |-- Landing.tsx            # Onboarding + Stripe checkout
|   |   |   |-- Integrations.tsx       # Integraciones SIEM/SOAR
|   |   |   |-- Marketplace.tsx        # Marketplace de plugins
|   |   |   |-- PlaybookBuilder.tsx    # Editor visual de playbooks
|   |   |   |-- RoleManagement.tsx     # Gestion RBAC
|   |   |   |-- SigmaRules.tsx         # Reglas Sigma
|   |   |   |-- ThreatHunting.tsx      # Threat hunting
|   |   |   |-- Ueba.tsx              # Analisis de comportamiento
|   |   |   |-- AiDecisions.tsx        # Decisiones AI autonomas
|   |   |   +-- ...
|   |   |-- lib/               # api.ts, services.ts
|   |   +-- types/             # Interfaces TypeScript
|   +-- package.json
|
|-- linkedin-prospector/       # Bot de prospeccion autonomo
|   |-- Dockerfile
|   |-- requirements.txt
|   |-- config.py              # Credenciales, limites, templates
|   |-- linkedin_client.py     # Wrapper seguro con rate limiting
|   |-- google_email_finder.py # Descubrimiento de emails via Google
|   |-- email_verifier.py      # Verificacion SMTP de emails
|   |-- prospector.py          # Ciclo de busqueda principal
|   |-- messenger.py           # Follow-up a conexiones aceptadas
|   +-- app.py                 # FastAPI + APScheduler
|
|-- desktop/                   # App Electron para monitoreo remoto
|   |-- main.js
|   |-- connect.html
|   |-- connect.css
|   +-- package.json
|
+-- deploy/
    |-- docker-compose.yml     # 14 servicios
    |-- .env                   # Variables de entorno
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
| **Redis** | 6379 | Rate limiting, cache, sesiones |
| **Elasticsearch** | 9200 | Indexacion de amenazas, busqueda full-text |
| **Backend** | 8081 | API Spring Boot |
| **Frontend** | 80 | React via Nginx |
| **Cloudflare Tunnel** | - | Acceso externo seguro |
| **Suricata** | host network | IDS/IPS en interfaz de red |
| **Suricata Bridge** | - | Parsea eve.json y envia al backend |
| **Auth Monitor** | - | Monitorea /var/log/auth.log |
| **Honeypot** | 2222, 8443, 2121, 2323, 2525, 13306, 13389 | SSH, HTTP, FTP, Telnet, SMTP, MySQL, RDP |
| **Nginx Monitor** | - | Monitorea access.log del frontend |
| **LinkedIn Prospector** | - | Bot autonomo de prospeccion (Python/FastAPI) |

---

## Como Funciona: Flujo Completo

### Paso 1: Registro de la Empresa

**Opcion A: Auto-Provisioning Self-Service (recomendado)**

El prospecto llena el formulario en `/landing`, selecciona plan (Starter/Professional/Enterprise), y es redirigido a Stripe Checkout con trial de 14 dias sin tarjeta. Al completar el checkout, un webhook auto-provisiona la empresa:

```
Landing form → Stripe Checkout (14 dias gratis, sin tarjeta)
  → webhook checkout.session.completed
  → auto-provision: company + user + alerts + email sequence
  → redirect a /login?provisioned=true
```

**Opcion B: Registro manual via API**

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

## Auto-Provisioning (Self-Service)

### Flujo Completo

```
1. Prospecto llena formulario en /landing (6 pasos)
   - Nombre empresa, dominio, email, nombre, contrasena, plan
2. POST /api/v1/onboarding/submit-and-checkout
   - Crea OnboardingRequest en BD
   - Crea Stripe Customer + Checkout Session
   - payment_method_collection = IF_REQUIRED (sin tarjeta)
   - trial_period_days = 14
3. Redirect a Stripe Checkout
4. Stripe envia webhook checkout.session.completed
5. StripeWebhookService detecta metadata onboardingRequestId
6. OnboardingService.provisionFromWebhook() (idempotente):
   - Crea Company + User admin
   - Configura alerta email por defecto
   - Inicia secuencia de emails de bienvenida
   - Enlaza Stripe Customer/Subscription con Company
   - Status: "provisioned"
7. Prospecto llega a /login?provisioned=true
   - Banner verde: "Tu cuenta esta lista!"
   - Login con credenciales del formulario
```

### Planes

| Plan | Precio | Incluye |
|---|---|---|
| Starter | $299/mes | 5 sensores, AI basico, email alerts |
| Professional | $799/mes | 20 sensores, AI completo, SOAR, integraciones |
| Enterprise | $1,999/mes | Ilimitado, AI Cortex, UEBA, Threat Hunting, SLA 1h |

---

## LinkedIn Prospector Bot

Bot autonomo de prospeccion multi-canal que busca leads en LinkedIn, descubre sus emails via Google, envia conexiones personalizadas, y alimenta el pipeline de email outreach.

### Arquitectura

```
Every 2 hours:
  LinkedIn Search → Find CISOs/CTOs/IT Directors
    → Google Search → Find their email
    → SMTP Verify → Confirm email exists
    → LinkedIn → Send connection request
    → POST /prospects/from-bot → Backend saves lead
    → SalesOutreachBot → 4-email drip sequence

Every 4 hours:
  Check accepted connections → Send follow-up with /pricing link

Every night 23:00:
  Self-improvement → Analyze stats, adjust strategy
```

### Multi-Canal

Cada prospecto recibe contacto por DOS canales simultaneos:
- **LinkedIn**: Conexion personalizada + follow-up tras aceptar
- **Email**: Secuencia de 4 emails (Intro → Valor → Prueba Social → Urgencia)

### Descubrimiento de Emails (Google)

```
Desde LinkedIn obtenemos: "Juan Garcia", "CISO", "Empresa Corp"
Google busca:
  1. "Juan Garcia" "Empresa Corp" email
  2. "juan.garcia@empresacorp.com" OR "jgarcia@empresacorp.com"
  3. "@empresacorp.com" CISO
Verificacion SMTP (RCPT TO) antes de enviar
```

### Limites de Seguridad

| Parametro | Valor |
|---|---|
| Conexiones/dia (L-V) | 20 |
| Conexiones/dia (S-D) | 5 |
| Mensajes/dia | 15 |
| Delay entre acciones | 3-7 min (aleatorio) |
| Horario activo | 9:00 - 18:00 |
| Auto-pausa | Si acceptance rate < 20% |
| Templates | 4 conexion + 2 follow-up (rotacion) |

### Endpoints de Gestion

| Metodo | Endpoint | Descripcion |
|---|---|---|
| GET | `/health` | Estado del bot |
| GET | `/status` | Stats detallados + scheduler |
| POST | `/search` | Trigger busqueda manual |
| POST | `/followup` | Trigger follow-up manual |
| POST | `/pause` | Pausar toda actividad |
| POST | `/resume` | Reanudar actividad |

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

## Funcionalidades Avanzadas

### Stripe Billing
- Checkout con trial de 14 dias sin tarjeta
- 3 planes: Starter ($299), Professional ($799), Enterprise ($1,999)
- Webhooks para auto-provisioning y gestion de suscripciones
- Portal de cliente para gestionar pago

### RBAC (Role-Based Access Control)
- Roles custom por empresa (admin, analyst, viewer, etc.)
- Permisos granulares por recurso
- Asignacion de roles a usuarios

### MFA (Multi-Factor Authentication)
- TOTP via Google Authenticator / Authy
- Setup con QR code
- Recovery codes

### SSO (Single Sign-On)
- Configuracion SAML/OIDC por empresa
- Auto-provisioning de usuarios SSO

### Integraciones SIEM/SOAR
- Splunk, QRadar, Sentinel, ELK
- Bidireccional: envio de alertas + recepcion de logs
- Ticketing: Jira, ServiceNow

### Sigma Rules
- Import/export de reglas Sigma
- Compilacion a queries del motor de correlacion
- Catalogo compartido

### Threat Hunting
- Queries ad-hoc sobre eventos historicos
- Guardado de hunts favoritos
- Resultados con enriquecimiento automatico

### UEBA (User & Entity Behavior Analytics)
- Perfiles de comportamiento por entidad
- Deteccion de anomalias estadisticas
- Scoring de riesgo por usuario

### Cloud Log Ingestion
- AWS CloudTrail, VPC Flow Logs
- Azure Activity Log, NSG Flow
- GCP Audit Log

### Marketplace
- Plugins de deteccion
- Integraciones comunitarias
- Instalacion one-click

### Email Sequences (Outreach)
- Secuencias de 4 emails automatizadas
- Templates personalizables
- Tracking de apertura y clicks

### Data Retention
- Politicas de retencion por empresa
- Purga automatica de datos antiguos
- Log de auditoría de eliminaciones

### API Keys
- Gestion de API keys por empresa
- Scopes y permisos por key
- Rotacion y revocacion

### Playbook Visual Builder
- Editor drag-and-drop de playbooks
- Nodos y edges conectables
- Ejecucion visual del flujo

### App de Escritorio (Electron)
- Monitoreo remoto del SOC
- Notificaciones nativas del SO
- Conexion segura al backend

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
| `STRIPE_API_KEY` | Stripe secret key | - |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret | - |
| `STRIPE_PRICE_STARTER` | Price ID plan Starter | - |
| `STRIPE_PRICE_PROFESSIONAL` | Price ID plan Professional | - |
| `STRIPE_PRICE_ENTERPRISE` | Price ID plan Enterprise | - |
| `SURICATA_INTERFACE` | Interfaz de red para Suricata | enp1s0 |
| `SOC_API_KEY` | API Key de la empresa | **Requerido** |
| `SOC_COMPANY_ID` | UUID de la empresa | **Requerido** |
| `LINKEDIN_EMAIL` | Email para login LinkedIn | - |
| `LINKEDIN_PASSWORD` | Password LinkedIn | - |
| `PROSPECTOR_API_KEY` | API key del bot prospector | - |
| `MAIL_HOST` | Servidor SMTP | smtp.gmail.com |
| `MAIL_PORT` | Puerto SMTP | 587 |
| `MAIL_USERNAME` | Usuario SMTP | - |
| `MAIL_PASSWORD` | Password SMTP (app password) | - |

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

### Billing (Stripe)
| Metodo | Endpoint | Auth | Descripcion |
|---|---|---|---|
| POST | `/api/v1/billing/checkout` | JWT | Crear sesion Stripe Checkout |
| POST | `/api/v1/billing/portal` | JWT | Portal de cliente Stripe |
| GET | `/api/v1/billing/status` | JWT | Estado de suscripcion |
| POST | `/api/v1/billing/webhook` | Stripe | Webhook de eventos |

### Onboarding (Auto-Provisioning)
| Metodo | Endpoint | Auth | Descripcion |
|---|---|---|---|
| POST | `/api/v1/onboarding/submit` | No | Enviar formulario |
| POST | `/api/v1/onboarding/submit-and-checkout` | No | Formulario + Stripe Checkout |
| POST | `/api/v1/onboarding/approve/{id}` | JWT (admin) | Aprobar manualmente |

### Prospects (LinkedIn Bot)
| Metodo | Endpoint | Auth | Descripcion |
|---|---|---|---|
| GET | `/api/v1/prospects` | JWT | Listar prospects |
| POST | `/api/v1/prospects/from-bot` | API Key | Crear lead desde bot |

### Roles (RBAC)
| Metodo | Endpoint | Auth | Descripcion |
|---|---|---|---|
| GET | `/api/v1/roles` | JWT | Listar roles |
| POST | `/api/v1/roles` | JWT | Crear rol |
| PUT | `/api/v1/roles/{id}` | JWT | Actualizar rol |
| POST | `/api/v1/roles/{id}/permissions` | JWT | Asignar permisos |

### MFA
| Metodo | Endpoint | Auth | Descripcion |
|---|---|---|---|
| POST | `/api/v1/mfa/setup` | JWT | Generar QR de setup |
| POST | `/api/v1/mfa/verify` | JWT | Verificar codigo TOTP |
| POST | `/api/v1/mfa/disable` | JWT | Desactivar MFA |

### Integrations
| Metodo | Endpoint | Auth | Descripcion |
|---|---|---|---|
| GET | `/api/v1/integrations` | JWT | Listar integraciones |
| POST | `/api/v1/integrations` | JWT | Crear integracion |
| POST | `/api/v1/integrations/{id}/test` | JWT | Probar conexion |
| POST | `/api/v1/integrations/{id}/sync` | JWT | Sincronizar datos |

### Sigma Rules
| Metodo | Endpoint | Auth | Descripcion |
|---|---|---|---|
| GET | `/api/v1/sigma` | JWT | Listar reglas Sigma |
| POST | `/api/v1/sigma` | JWT | Crear regla |
| POST | `/api/v1/sigma/import` | JWT | Importar regla YAML |

### Threat Hunting
| Metodo | Endpoint | Auth | Descripcion |
|---|---|---|---|
| POST | `/api/v1/hunting/search` | JWT | Ejecutar busqueda |
| GET | `/api/v1/hunting/saved` | JWT | Listar hunts guardados |
| POST | `/api/v1/hunting/saved` | JWT | Guardar hunt |

### UEBA
| Metodo | Endpoint | Auth | Descripcion |
|---|---|---|---|
| GET | `/api/v1/ueba/profiles` | JWT | Perfiles de comportamiento |
| GET | `/api/v1/ueba/anomalies` | JWT | Anomalias detectadas |

### Marketplace
| Metodo | Endpoint | Auth | Descripcion |
|---|---|---|---|
| GET | `/api/v1/marketplace` | JWT | Listar items |
| POST | `/api/v1/marketplace/{id}/install` | JWT | Instalar plugin |

### Auditorias, Pentests, Vulnerabilidades, Certificaciones

Mismos endpoints documentados con lifecycle completo de estados.

---

## Base de Datos

### Migraciones Flyway (V1-V34)

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
| V15 | Fix correlation rules y lower threshold |
| V16 | Block malicious IPs |
| V17 | Stripe billing: invoices, billing_events |
| V18 | MFA support (TOTP) |
| V19 | RBAC: roles, permissions, role_permissions, user_roles |
| V20 | Data retention policies y logs |
| V21 | API keys con scopes |
| V22 | Email sequences y jobs |
| V23 | SSO configuration |
| V24 | Expanded threat enrichment fields |
| V25 | Integrations (SIEM/SOAR/Ticketing) |
| V26 | Playbook visual builder (edges) |
| V27 | Threat hunting (saved_hunts, hunt_results) |
| V28 | AI Cortex (learning events, performance metrics) |
| V29 | Sigma rules |
| V30 | Cloud log sources (AWS/Azure/GCP) |
| V31 | UEBA (entity_behavior_profiles, behavior_anomalies) |
| V32 | Marketplace (items, installations) |
| V33 | Prospects y outreach (prospects, outreach_logs, outreach_metrics) |
| V34 | Onboarding selected_plan field |

### Tablas Principales

- `companies` - Empresas con API Key y Stripe customer
- `users` - Usuarios con roles y MFA
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
- `playbook_edges` - Conexiones del visual builder
- `mitre_techniques` - Tecnicas MITRE ATT&CK
- `threat_mitre_mappings` - Mapeo amenazas-tecnicas
- `roles` / `permissions` - RBAC
- `invoices` / `billing_events` - Facturacion Stripe
- `api_keys` - API keys con scopes
- `sso_configurations` - SSO SAML/OIDC
- `integrations` / `integration_tickets` - SIEM/SOAR
- `sigma_rules` - Reglas de deteccion Sigma
- `saved_hunts` / `hunt_results` - Threat hunting
- `entity_behavior_profiles` / `behavior_anomalies` - UEBA
- `marketplace_items` / `marketplace_installations` - Marketplace
- `prospects` / `outreach_logs` - Pipeline de ventas
- `email_sequence_jobs` - Secuencias de email automatizadas
- `cloud_log_sources` - Fuentes de logs cloud
- `data_retention_logs` - Auditoría de retencion de datos

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
2. (Opcional) Si MFA habilitado -> requiere codigo TOTP
3. Frontend guarda token, Axios interceptor agrega "Bearer token"
4. JwtAuthenticationFilter valida en cada request
5. PermissionChecker valida permisos RBAC
6. AuthUtils extrae companyId para aislamiento multi-tenant
7. Token expirado -> 401 -> Refresh automatico o redirect a login
```

### MFA (Multi-Factor Authentication)
- TOTP (Time-based One-Time Password)
- Compatible con Google Authenticator, Authy, etc.
- Setup via QR code + recovery codes
- Obligatorio para roles admin (configurable)

### RBAC (Role-Based Access Control)
- Roles custom por empresa
- Permisos granulares: `incidents:read`, `playbooks:execute`, `settings:admin`, etc.
- PermissionChecker valida en cada endpoint protegido

### SSO (Single Sign-On)
- SAML 2.0 y OIDC
- Configuracion per-company
- Auto-provisioning de usuarios

### API Keys
- API Keys con scopes por empresa
- Header: `X-API-Key` para sensores, `X-Prospector-Key` para bot
- Rotacion y revocacion desde el panel
- Rate limiting via Redis

### API Key para Sensores
- Cada empresa tiene un API Key unico
- `/sensors/upload` es publico pero requiere API Key valida
- Se valida `company_id` del payload con la empresa del API Key

### Aislamiento Multi-tenant
- Todas las queries filtran por `companyId` del usuario autenticado
- Acceso a datos de otra empresa = HTTP 403

### CORS
- Origenes: configurable via `CORS_ALLOWED_ORIGINS`
- Default: `https://soc.blackwolfsec.io, http://localhost:5173, http://localhost:80`

### Rate Limiting
- Redis-backed rate limiter
- Configurable por endpoint y por empresa
- Proteccion contra abuso de API

### Monitoring
- Actuator endpoints: health, info, metrics, prometheus
- Health details: when_authorized
- Elasticsearch para busqueda y analisis de amenazas historicas
