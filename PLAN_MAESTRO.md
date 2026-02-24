# BlackWolf SOC — Plan Maestro Completo

## Estado del Proyecto

**Plataforma actual:** SOC completa con 44 modelos, 22 controllers, 30 servicios, 26 páginas frontend, AI autónomo (Claude), correlación avanzada, SOAR, MITRE ATT&CK, app de escritorio Electron.

**Objetivo:** Convertir BlackWolf en una empresa viva que encuentra clientes mid-market (200-2000 empleados), los onboardea, entrega valor, y mejora autónomamente.

**Stack:** Spring Boot 3.2.3 + Java 21 + MySQL 8 + Flyway + React/TypeScript + Tailwind + Vite + Docker Compose + Cloudflare Tunnel

**Dominio producción:** https://soc.blackwolfsec.io

---

## Pricing

| Plan | $/mes | Assets | Usuarios | Retención |
|------|-------|--------|----------|-----------|
| Starter | $1,999 | 50 | 5 | 30 días |
| Professional | $4,999 | 200 | 15 | 90 días |
| Enterprise | $9,999 | 500 | Ilimitados | 1 año |

Trial gratuito de 14 días. El AI genera reporte automático de amenazas que vende solo.

---

## FASE 1: Cimientos y Primeros Clientes (Semanas 1-8)

**Meta:** Cobrar dinero. Conseguir 5-10 clientes pagando.

### 1.1 Stripe Billing — COMPLETADO

**Estado: 100% implementado, pendiente deploy**

Archivos creados (11):
- `backend/.../resources/db/migration/V17__stripe_billing.sql` — Schema: columnas en companies + tablas billing_events e invoices
- `backend/.../config/StripeConfig.java` — @PostConstruct: Stripe.apiKey
- `backend/.../model/BillingEvent.java` — Entity: audit log de webhooks
- `backend/.../model/Invoice.java` — Entity: caché de facturas Stripe
- `backend/.../repository/BillingEventRepository.java` — findByStripeEventId (idempotencia)
- `backend/.../repository/InvoiceRepository.java` — findByCompanyId, findByStripeInvoiceId
- `backend/.../dto/BillingDTOs.java` — BillingOverview, CheckoutResponse, PlanLimits, PlanInfo, etc.
- `backend/.../service/BillingService.java` — Checkout, cambio plan, cancelación, reactivación, portal, enforcement
- `backend/.../service/StripeWebhookService.java` — 5 webhooks con idempotencia
- `backend/.../controller/BillingController.java` — 8 endpoints REST
- `frontend/src/pages/Billing.tsx` — Dashboard completo: plan actual, usage bars, grid de planes, facturas

Archivos modificados (10):
- `backend/pom.xml` — +stripe-java:26.5.0
- `backend/.../resources/application.yml` — +stripe.api-key, webhook-secret, prices.*
- `deploy/docker-compose.yml` — +STRIPE_* env vars
- `backend/.../model/Company.java` — +8 campos: stripeCustomerId, subscriptionStatus, maxAssets, etc.
- `backend/.../repository/CompanyRepository.java` — +findByStripeCustomerId()
- `backend/.../config/SecurityConfig.java` — +/api/v1/billing/webhook en permitAll
- `backend/.../service/OnboardingService.java` — +billingService.createStripeCustomer() post-provisión
- `frontend/src/lib/services.ts` — +billingService (7 métodos)
- `frontend/src/App.tsx` — +ruta /billing
- `frontend/src/components/Layout.tsx` — +nav item "Billing" con CreditCard icon (solo admin)

Variables de entorno configuradas en deploy/.env:
- STRIPE_API_KEY=sk_live_51PwlPHCl8P39vjkQ... (configurado)
- STRIPE_WEBHOOK_SECRET=whsec_A8bDkkQMfioyjKGqdAApNGTDbYPh8plb (configurado)
- STRIPE_PRICE_STARTER=price_1T3ylzCl8P39vjkQgha1B3MM (configurado)
- STRIPE_PRICE_PROFESSIONAL=price_1T3ymdCl8P39vjkQJdq74DKg (configurado)
- STRIPE_PRICE_ENTERPRISE=price_1T3yn0Cl8P39vjkQfZridcam (configurado)

Webhook endpoint en Stripe Dashboard: https://soc.blackwolfsec.io/api/v1/billing/webhook
Eventos: checkout.session.completed, invoice.payment_succeeded, invoice.payment_failed, customer.subscription.updated, customer.subscription.deleted

Endpoints del BillingController:
- GET /api/v1/billing/overview — Plan actual, status, trial, usage, facturas
- GET /api/v1/billing/plans — Lista de planes con precios y límites
- POST /api/v1/billing/checkout — Crea Stripe Checkout Session → devuelve URL
- POST /api/v1/billing/change-plan — Upgrade/downgrade con proration
- POST /api/v1/billing/cancel — Cancela al final del período
- POST /api/v1/billing/reactivate — Reactiva suscripción cancelada
- POST /api/v1/billing/portal — Stripe Customer Portal → devuelve URL
- POST /api/v1/billing/webhook — Stripe webhook (sin auth, firma verificada)

**Pendiente:** Deploy a producción y test end-to-end con tarjeta real.

---

### 1.2 MFA/2FA con TOTP — COMPLETADO

**Estado: 100% implementado, pendiente deploy**

Archivos creados (4):
- `backend/.../service/MfaService.java` — Generación TOTP (dev.samstevens.totp), QR code base64, verificación, 8 recovery codes
- `backend/.../controller/MfaController.java` — POST setup, POST verify, POST disable, GET status
- `backend/.../resources/db/migration/V18__mfa_support.sql` — 3 columnas en users
- `frontend/src/components/MfaSetup.tsx` — Wizard 3 pasos: init → scan QR → done (recovery codes)

Archivos modificados (7):
- `backend/pom.xml` — +dev.samstevens.totp:totp:1.7.1
- `backend/.../model/User.java` — +mfaEnabled, mfaSecret (@JsonIgnore), mfaRecoveryCodes (@JsonIgnore)
- `backend/.../dto/AuthDTOs.java` — +requiresMfa, mfaToken en AuthResponse, +MfaLoginRequest class, +mfaPending() factory
- `backend/.../service/AuthService.java` — +MfaService, ConcurrentHashMap<mfaToken,userId>, login con paso MFA, verifyMfa()
- `backend/.../controller/AuthController.java` — +POST /mfa-verify, cookies condicionales en login
- `frontend/src/pages/Login.tsx` — Paso MFA: code input 6-8 chars, handleMfaSubmit, back to login
- `frontend/src/pages/Settings.tsx` — Sección MFA: enable/disable, status check, integración MfaSetup

Flujo MFA login:
1. POST /auth/login → si MFA habilitado → {requiresMfa: true, mfaToken: UUID}
2. POST /auth/mfa-verify → {mfaToken, code} → JWT tokens completos
3. Recovery codes (8 chars) aceptados como alternativa al TOTP de 6 dígitos

SecurityConfig: /api/v1/auth/mfa-verify en permitAll (usuario aún no tiene JWT)

---

### 1.3 RBAC Granular — COMPLETADO

**Estado: 100% implementado, pendiente deploy**

Archivos creados (7):
- `backend/.../model/Permission.java` — Entity: resource + action (id = "resource:action")
- `backend/.../model/Role.java` — Entity con @ManyToMany permissions (EAGER), system/custom per-company
- `backend/.../repository/PermissionRepository.java` + `RoleRepository.java`
- `backend/.../service/RbacService.java` — getPermissionsForRole, resolveRole, CRUD custom roles, assignRole
- `backend/.../security/PermissionChecker.java` — @Component("perm") con has() y hasAny(), superadmin bypass
- `backend/.../controller/RoleController.java` — GET list, GET by id, GET permissions, POST create, PUT update, DELETE, POST assign
- `backend/.../resources/db/migration/V19__rbac_roles_permissions.sql` — tables + 37 permissions + 5 system roles + mappings
- `frontend/src/pages/RoleManagement.tsx` — Roles list with expandable permissions, create/edit modal with permission matrix

Archivos modificados (10):
- `backend/.../config/SecurityConfig.java` — +@EnableMethodSecurity
- `backend/.../security/CustomUserDetailsService.java` — Carga permissions via RbacService como GrantedAuthority
- `backend/.../dto/AuthDTOs.java` — +permissions List<String> en AuthResponse, nuevo constructor
- `backend/.../service/AuthService.java` — +RbacService, incluye permissions en login, mfaVerify, refresh responses
- `frontend/src/context/AuthContext.tsx` — +permissions state, +hasPermission(), +hasAnyPermission()
- `frontend/src/pages/Login.tsx` — Pasa permissions al login()
- `frontend/src/components/Layout.tsx` — Nav items filtrados por permiso, +ShieldCheck icon, +Roles nav item
- `frontend/src/lib/services.ts` — +rbacService (7 métodos)
- `frontend/src/App.tsx` — +ruta /roles
- Controllers con @PreAuthorize: UserController, IncidentController, ThreatController, AssetController, BillingController, PlaybookController, AlertController

Approach: Permissions loaded from DB on each request via CustomUserDetailsService (not JWT claims). Always fresh, no stale permissions.

5 System Roles: viewer (14 perms), analyst (21), soc_manager (31), compliance_officer (19), admin (all 37). Custom roles per-company.

37 Permissions across 18 resources: dashboard, threats, incidents, playbooks, assets, sensors, alerts, audits, pentests, vulnerabilities, certifications, users, billing, mitre, ai_agent, reports, roles, settings. Actions: read, write, delete, execute.

---

### 1.4 Retención de Datos + API Keys — COMPLETADO

**Estado: 100% implementado, pendiente deploy**

Archivos creados (8):
- `backend/.../resources/db/migration/V20__data_retention.sql` — data_retention_logs table + indices en timestamp columns
- `backend/.../resources/db/migration/V21__api_keys.sql` — api_keys table (hash, prefix, scopes, expiry) + migración de companies.api_key existentes
- `backend/.../model/DataRetentionLog.java` — Entity: audit de retention jobs
- `backend/.../model/ApiKey.java` — Entity: multi-key por empresa, keyHash @JsonIgnore
- `backend/.../repository/DataRetentionLogRepository.java` + `ApiKeyRepository.java`
- `backend/.../service/DataRetentionService.java` — @Scheduled cron 3 AM diario, purga threat_events/alert_history/activity_logs según retentionDays por empresa
- `backend/.../service/ApiKeyService.java` — Crear (raw key solo 1 vez), revocar, rotar, validar (SHA-256), eliminar
- `backend/.../controller/ApiKeyController.java` — 6 endpoints REST + retention-logs, todos con @PreAuthorize

Archivos modificados (2):
- `backend/.../service/SensorService.java` — +ApiKeyService, validación primero contra api_keys (hash), fallback a companies.api_key legacy
- `frontend/src/pages/Settings.tsx` — Sección API Keys: crear, rotar, revocar, eliminar, banner con raw key + copy
- `frontend/src/lib/services.ts` — +apiKeyService (6 métodos)

API Key format: `bw_` + 32 bytes Base64url. Stored as SHA-256 hash. Prefix (8 chars) visible para identificación.

---

### 1.5 Emails Automáticos de Onboarding + Redis + Sales Funnel — COMPLETADO

**Estado: 100% implementado, pendiente deploy**

Archivos creados (7):
- `backend/.../resources/db/migration/V22__email_sequences.sql` — Tabla email_sequence_jobs (drip queue)
- `backend/.../model/EmailSequenceJob.java` — Entity: scheduled email jobs con status, attempts, metadata JSON
- `backend/.../repository/EmailSequenceJobRepository.java` — findByStatus+scheduledAt, findByCompanyId
- `backend/.../service/EmailTemplateService.java` — Templates HTML profesionales con branding BlackWolf: welcome, deploy_sensor, weekly_report, trial_ending, alertHtml
- `backend/.../service/EmailSequenceService.java` — @Scheduled cada 5 min, 4 emails drip (inmediato, +2d, +7d, +12d), 3 reintentos, cancelación
- `backend/.../config/RedisConfig.java` — StringRedisTemplate bean
- `frontend/src/pages/Pricing.tsx` — Sales funnel completo: 3 planes con precios Stripe, toggle annual/monthly, feature comparison table, how it works, capabilities, FAQ, CTAs

Archivos modificados (8):
- `backend/pom.xml` — +spring-boot-starter-data-redis
- `backend/.../resources/application.yml` — +spring.data.redis.*, +app.base-url
- `deploy/docker-compose.yml` — +redis:7-alpine service con healthcheck, +redis_data volume, +REDIS_HOST/MAIL_* env vars
- `backend/.../service/RateLimitService.java` — Upgraded: Redis como fast path para rate limiting, MySQL como fallback y audit trail, +checkApiRate()
- `backend/.../service/OnboardingService.java` — +emailSequenceService.scheduleOnboardingSequence() post-provisión (paso 5)
- `backend/.../service/AlertService.java` — Upgraded a MimeMessage con HTML templates (EmailTemplateService) en vez de SimpleMailMessage
- `frontend/src/pages/Landing.tsx` — +link a /pricing en header
- `frontend/src/App.tsx` — +ruta /pricing

Email Drip Sequence:
1. Inmediato: Welcome — credenciales, login link, quick start guide
2. +2 días: Deploy Sensor — guía con Docker commands, API key
3. +7 días: Weekly Report — stats o "deploy sensor para ver datos"
4. +12 días: Trial Ending — planes con precios, CTA a /billing

Sales Funnel (Pricing.tsx):
- 3 planes: Starter $1,999, Professional $4,999, Enterprise $9,999
- Toggle monthly/annual (17% descuento)
- Feature comparison table (21 features × 3 planes)
- How it works (4 steps)
- 6 capability cards
- FAQ (6 preguntas)
- CTAs: Start Free Trial → /landing, Contact Sales → email

---

## FASE 2: Escala y Diferenciación (Semanas 9-20)

**Meta:** 30-50 clientes. Integraciones enterprise. Posicionamiento: "El SOC que piensa."

### 2.1 SSO/SAML — PENDIENTE

Archivos nuevos:
- `backend/.../config/Saml2Config.java`
- `backend/.../service/SsoService.java` — SAML + OIDC
- `backend/.../controller/SsoController.java`
- `backend/.../model/SsoConfiguration.java` + repositorio
- `backend/.../resources/db/migration/V22__sso_configuration.sql`

Modificaciones:
- `pom.xml` — +spring-security-saml2-service-provider
- `SecurityConfig.java` — SAML2 filter chain para /api/v1/sso/saml/**
- `Login.tsx` — Botón "Sign in with SSO"
- `Settings.tsx` — Config SSO (upload metadata, test conexión)

---

### 2.2 Threat Intel Expandido — PENDIENTE

Archivos nuevos:
- `backend/.../service/threatintel/ThreatIntelProvider.java` (interface)
- `backend/.../service/threatintel/VirusTotalProvider.java`
- `backend/.../service/threatintel/GreyNoiseProvider.java`
- `backend/.../service/threatintel/ShodanProvider.java`
- `backend/.../service/threatintel/OTXProvider.java`
- `backend/.../resources/db/migration/V23__expanded_threat_enrichment.sql`
- `frontend/src/components/ThreatEnrichmentPanel.tsx`

Modificaciones:
- `ThreatIntelService.java` — Orquestar múltiples providers
- `application.yml` — Config para cada provider (api-key, enabled)
- `AiAutonomousAgentService.java` — Enriquecer contexto AI con datos de todos los providers

---

### 2.3 Jira/ServiceNow + PagerDuty/OpsGenie — PENDIENTE

Archivos nuevos:
- `backend/.../service/integrations/TicketingIntegration.java` (interface)
- `backend/.../service/integrations/JiraIntegrationService.java`
- `backend/.../service/integrations/ServiceNowIntegrationService.java`
- `backend/.../service/alerts/PagerDutyAlertProvider.java`
- `backend/.../service/alerts/OpsGenieAlertProvider.java`
- `backend/.../controller/IntegrationController.java`
- `backend/.../model/IntegrationConfig.java` + repositorio
- `backend/.../resources/db/migration/V24__integrations.sql`
- `frontend/src/pages/Integrations.tsx` — Marketplace de integraciones

Modificaciones:
- `IncidentService.java` — Auto-crear ticket en Jira/ServiceNow al crear incidente
- `AlertService.java` — Agregar cases pagerduty y opsgenie

---

### 2.4 Playbooks con Lógica Condicional + Visual Builder — PENDIENTE

Archivos nuevos:
- `backend/.../resources/db/migration/V25__playbook_conditions.sql`
- `frontend/src/components/PlaybookBuilder.tsx` — Editor visual drag-and-drop (ReactFlow)

Modificaciones:
- `PlaybookStep.java` — +conditionExpression, onSuccessStepId, onFailureStepId, isParallel
- `PlaybookService.java` — Motor de ejecución basado en grafos
- `package.json` (frontend) — +@xyflow/react

---

### 2.5 Threat Hunting — PENDIENTE

Archivos nuevos:
- `backend/.../service/ThreatHuntingService.java` — Query builder, saved queries, scheduled hunts
- `backend/.../controller/ThreatHuntingController.java`
- `frontend/src/pages/ThreatHunting.tsx` — Interface de búsqueda con filtros

---

### 2.6 Elasticsearch — PENDIENTE

Archivos nuevos:
- `backend/.../config/ElasticsearchConfig.java`
- `backend/.../service/ThreatIndexService.java` — Indexa eventos en ES
- `backend/.../elasticsearch/ThreatEventDocument.java`

Modificaciones:
- `docker-compose.yml` — +servicio elasticsearch:8.12.0
- `pom.xml` — +spring-boot-starter-data-elasticsearch
- `application.yml` — spring.elasticsearch.uris
- `SensorService.java` — Después de guardar en MySQL, indexar en ES
- `ThreatHuntingService.java` — Queries contra ES

---

## FASE 3: Crecimiento Autónomo — El Organismo Vivo (Semanas 21-36)

**Meta:** 100+ clientes. El sistema se mejora solo. Efecto de red.

### 3.1 El Cortex — Coordinación de Agentes AI — PENDIENTE

Archivos nuevos:
- `backend/.../service/ai/CortexService.java` — Coordinador central
- `backend/.../service/ai/FeedbackLoopService.java` — Aprende de correcciones de analistas
- `backend/.../service/ai/CrossTenantIntelligence.java` — Patrones anonimizados cross-company
- `backend/.../model/AiLearningEvent.java` + repositorio
- `backend/.../resources/db/migration/V26__ai_cortex.sql`

Funciones del Cortex:
- recordDecision() — Registra cada decisión AI
- recordAnalystOverride() — Cuando un analista corrige al AI, el sistema aprende
- selfEvaluate() (diario) — Compara verdicts vs overrides, ajusta umbrales
- aggregateCrossTenantPatterns() (diario) — IP X atacó A,B,C → alertar D,E,F
- proactiveHunting() (cada 4h) — Busca IoCs de intel cruzada

Modificaciones:
- `AiAutonomousAgentService.java` — +cortexService.recordDecision()
- `IncidentService.java` — +cortexService.recordAnalystOverride()

Migration V26:
```sql
CREATE TABLE ai_learning_events (id, company_id, event_type, original_verdict, corrected_verdict, threat_type, context JSON, learned_at);
CREATE TABLE cross_tenant_patterns (id, pattern_type, pattern_data JSON, confidence, source_count, is_active);
```

---

### 3.2 Reglas SIGMA — PENDIENTE

Archivos nuevos:
- `backend/.../service/SigmaRuleService.java` — Parser YAML, evaluador contra ES
- `backend/.../model/SigmaRule.java` + repositorio
- `backend/.../controller/SigmaController.java`
- `backend/.../resources/db/migration/V27__sigma_rules.sql`
- `frontend/src/pages/SigmaRules.tsx` + `frontend/src/components/SigmaEditor.tsx`

Modificaciones:
- `SensorService.java` — +sigmaRuleService.evaluateEvent() al pipeline

---

### 3.3 Ingestion de Cloud Logs — PENDIENTE

Archivos nuevos:
- `backend/.../service/cloudlogs/CloudLogIngestionService.java` (orquestador)
- `backend/.../service/cloudlogs/AwsCloudTrailIngester.java`
- `backend/.../service/cloudlogs/AzureActivityLogIngester.java`
- `backend/.../service/cloudlogs/GcpAuditLogIngester.java`
- `backend/.../controller/CloudLogController.java`
- `backend/.../resources/db/migration/V28__cloud_log_sources.sql`

---

### 3.4 UEBA — Behavioral Analytics — PENDIENTE

Archivos nuevos:
- `backend/.../service/UebaService.java` — Baselines, detección de anomalías
- `backend/.../model/EntityBehaviorProfile.java` + `BehaviorAnomaly.java` + repositorios
- `backend/.../resources/db/migration/V29__ueba.sql`
- `frontend/src/pages/Ueba.tsx` — Dashboard de comportamiento

Funciones:
- updateBehaviorProfiles() (diario) — Computa baseline por entidad
- evaluateEvent() (tiempo real) — Score anomalía 0-100

Modificaciones:
- `SensorService.java` — +uebaService.evaluateEvent() al pipeline

---

### 3.5 Marketplace — PENDIENTE

Archivos nuevos:
- `backend/.../service/MarketplaceService.java`
- `backend/.../controller/MarketplaceController.java`
- `backend/.../model/MarketplaceItem.java` + `MarketplaceInstallation.java`
- `backend/.../resources/db/migration/V30__marketplace.sql`
- `frontend/src/pages/Marketplace.tsx` + `frontend/src/components/MarketplaceCard.tsx`

Tipos: detection_rule (SIGMA), playbook_template, correlation_rule, integration_connector.

---

### 3.6 Onboarding Automático + Entrega de Valor Continua — PENDIENTE

Archivos nuevos:
- `backend/.../service/ai/AutomatedOnboardingAgent.java` — AI analiza primeras 24h, auto-configura
- `backend/.../service/ai/ValueDeliveryAgent.java` — Emails semanales/mensuales de valor
- `backend/.../service/ai/ClientHealthScoreService.java` — Score 0-100 por company

Health Score evalúa: actividad sensores, tiempo respuesta alertas, adopción features, feedback AI, cobertura vectores.
- Score < 30 → "Tus sensores no reportan desde hace X días"
- Score < 50 → "3 quick wins para mejorar tu postura"

---

## Arquitectura Final — El Organismo Vivo

```
MUNDO EXTERIOR
  |
  v
[Suricata] [Auth Monitor] [Honeypot] [Cloud Logs] [EDR]
  |             |              |           |          |
  +-------------+--------------+-----------+----------+
                        |
                        v
              [SensorService.processUpload()]  <-- Punto de entrada único
                        |
        +-------+-------+-------+-------+-------+
        |       |       |       |       |       |
        v       v       v       v       v       v
    Correlación SIGMA   UEBA   AI Agent Playbooks Alerts
        |       |       |       |       |       |
        +-------+-------+-------+-------+-------+
                        |
                        v
                  [CortexService]  <-- El cerebro
                   /    |    \
                  v     v     v
            Feedback  Cross-  Proactive
            Loop     Tenant   Hunting
                   Intel
                        |
                        v
              [ValueDeliveryAgent]  <-- Entrega valor continuo
              [ClientHealthScore]  <-- Detecta clientes en riesgo
              [AutoOnboarding]     <-- Configura nuevos clientes solo
```

---

## Resumen de Progreso

| Fase | Bloque | Estado | Migration |
|------|--------|--------|-----------|
| 1.1 | Stripe Billing | COMPLETADO | V17 |
| 1.2 | MFA/TOTP | COMPLETADO | V18 |
| 1.3 | RBAC Granular | COMPLETADO | V19 |
| 1.4 | Retención + API Keys | COMPLETADO | V20-V21 |
| 1.5 | Emails + Redis + Sales Funnel | COMPLETADO | V22 |
| 2.1 | SSO/SAML | COMPLETADO | V23 |
| 2.2 | Threat Intel Expandido | COMPLETADO | V24 |
| 2.3 | Jira/ServiceNow/PagerDuty | COMPLETADO | V25 |
| 2.4 | Playbooks Visual Builder | COMPLETADO | V26 |
| 2.5 | Threat Hunting | COMPLETADO | V27 |
| 2.6 | Elasticsearch | COMPLETADO | — (ES index) |
| 3.1 | Cortex AI | COMPLETADO | V28 |
| 3.2 | Reglas SIGMA | COMPLETADO | V29 |
| 3.3 | Cloud Logs | COMPLETADO | V30 |
| 3.4 | UEBA | COMPLETADO | V31 |
| 3.5 | Marketplace | COMPLETADO | V32 |
| 3.6 | Onboarding Automático | COMPLETADO | — |

---

## Notas Técnicas

- Backend compila solo en Docker (no hay Java/Maven local): `docker-compose build backend`
- Frontend TypeScript verifica con: `cd frontend && npx tsc --noEmit`
- Flyway migrations se ejecutan automáticamente al arrancar el backend
- Base de datos: MySQL 8.0 con UUIDs string como PKs
- Todas las entidades usan Lombok @Data
- Patrón multi-tenant: companyId en cada tabla, extraído de JWT via AuthUtils
- AI usa Claude (claude-sonnet-4-20250514) para análisis autónomo
- Deploy actual: Docker Compose en servidor propio + Cloudflare Tunnel
