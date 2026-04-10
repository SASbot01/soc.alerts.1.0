# BlackWolf SOC — Manual de Usuario

## Indice

1. [Overview (Dashboard)](#1-overview-dashboard)
2. [Threats (Amenazas)](#2-threats-amenazas)
3. [Incidents (Incidentes)](#3-incidents-incidentes)
4. [Playbooks](#4-playbooks)
5. [Assets](#5-assets)
6. [Sensors (Sensores)](#6-sensors-sensores)
7. [Alerts (Reglas de Alerta)](#7-alerts-reglas-de-alerta)
8. [AI Agent (Decisiones IA)](#8-ai-agent-decisiones-ia)
9. [AI Evolution](#9-ai-evolution)
10. [Threat Hunting](#10-threat-hunting)
11. [SIGMA Rules](#11-sigma-rules)
12. [UEBA](#12-ueba)
13. [Infrastructure](#13-infrastructure)
14. [MITRE ATT&CK](#14-mitre-attck)
15. [Audits (Auditorias)](#15-audits-auditorias)
16. [Pentests](#16-pentests)
17. [Vulnerabilities](#17-vulnerabilities)
18. [Certifications](#18-certifications)
19. [Users (Usuarios)](#19-users-usuarios)
20. [Roles](#20-roles)
21. [Integrations](#21-integrations)
22. [Marketplace](#22-marketplace)
23. [Billing (Facturacion)](#23-billing-facturacion)
24. [Settings (Configuracion)](#24-settings-configuracion)
25. [AI Chat Assistant](#25-ai-chat-assistant)
26. [SuperAdmin Panel](#26-superadmin-panel)
27. [Agente EDR Descargable](#27-agente-edr-descargable)

---

## 1. Overview (Dashboard)

**Ruta:** `/`
**Permiso:** `dashboard:read`

Panel principal del SOC. Muestra en tiempo real:

- **Contadores globales:** Total de amenazas, incidentes abiertos, sensores activos, assets monitoreados.
- **Grafico de amenazas:** Tendencia de amenazas detectadas en las ultimas 24h/7d/30d.
- **Amenazas recientes:** Lista en tiempo real de las ultimas amenazas con severidad, IP origen/destino y tipo.
- **Estado de sensores:** Cuantos sensores estan online, offline o pendientes.
- **Actividad de incidentes:** Incidentes mas recientes con su estado (abierto, investigando, resuelto).

**Como usarlo:** Es la primera pantalla al entrar. Sirve para tener una vision rapida del estado de seguridad. Si ves amenazas criticas (severidad 8-10), haz clic para ir al detalle.

---

## 2. Threats (Amenazas)

**Ruta:** `/threats`
**Permiso:** `threats:read`

Lista completa de todas las amenazas detectadas por los sensores.

- **Filtros:** Por severidad, tipo de amenaza, rango de fechas, IP origen/destino, sensor.
- **Campos:** Fecha, tipo (brute_force, port_scan, malware, c2, etc.), severidad (1-10), IP origen, IP destino, puerto, sensor que la detecto.
- **Acciones:** Ver detalle, escalar a incidente, marcar como falso positivo.
- **Busqueda:** Por IP, tipo de amenaza o descripcion.

**Como usarlo:** Revisa esta seccion periodicamente. Filtra por severidad >= 7 para ver las criticas. Las amenazas repetidas desde la misma IP pueden indicar un ataque sostenido — escalalo a incidente.

---

## 3. Incidents (Incidentes)

**Ruta:** `/incidents`
**Permiso:** `incidents:read`

Gestion del ciclo de vida de incidentes de seguridad.

- **Crear incidente:** Manual o escalado automaticamente desde amenazas criticas.
- **Estados:** Abierto → Investigando → Contenido → Resuelto → Cerrado.
- **Prioridad:** Critica, Alta, Media, Baja.
- **Detalle del incidente** (`/incidents/:id`):
  - Timeline de eventos y cambios de estado.
  - Comentarios del equipo SOC.
  - Amenazas asociadas.
  - Cambio de estado y asignacion.

**Como usarlo:** Cuando detectas una amenaza critica, crea un incidente. Asignalo a un analista, documenta los pasos de investigacion en los comentarios, y ve cambiando el estado conforme avanza la respuesta.

---

## 4. Playbooks

**Ruta:** `/playbooks`
**Permiso:** `playbooks:read`

Procedimientos de respuesta predefinidos y personalizados.

- **Catalogo de playbooks:** Playbooks predefinidos para escenarios comunes (brute force, malware, phishing, data exfiltration, etc.).
- **Mis playbooks:** Los que has desplegado/activado.
- **Cada playbook contiene:**
  - Pasos de respuesta ordenados.
  - Amenazas que cubre.
  - Nivel de automatizacion.
- **Playbook Builder** (`/playbooks/:id/builder`):
  - Editor visual de flujo (drag & drop).
  - Conecta pasos de respuesta con condiciones logicas.
  - Define acciones automaticas (bloquear IP, notificar, crear incidente).

**Como usarlo:** Despliega los playbooks del catalogo que apliquen a tu infraestructura. Usa el Builder para crear flujos personalizados. Cuando ocurra un incidente, el playbook correspondiente guiara la respuesta.

---

## 5. Assets

**Ruta:** `/assets`
**Permiso:** `assets:read`

Inventario de todos los activos de tu organizacion.

- **Tipos de asset:** Servidor, estacion de trabajo, router, firewall, base de datos, aplicacion web, etc.
- **Campos:** Nombre, tipo, IP, sistema operativo, estado (activo/inactivo), criticidad.
- **Crear/editar assets** para mantener el inventario actualizado.
- **Asignar sensores** a assets para monitorearlos.

**Como usarlo:** Registra todos tus equipos y servicios criticos. Asigna sensores a cada uno desde la seccion de Sensores. Esto permite correlacionar amenazas con los activos afectados.

---

## 6. Sensors (Sensores)

**Ruta:** `/sensors`
**Permiso:** `sensors:read`

Despliegue y gestion de sensores de seguridad.

- **Catalogo de sensores:** Sensores predefinidos por categoria:
  - **NETWORK:** IDS/IPS (Suricata), monitores de trafico.
  - **ENDPOINT:** Agente EDR, monitores de auth logs.
  - **DECEPTION:** Honeypots (SSH, HTTP, FTP, MySQL, etc.).
  - **WEB:** WAF, monitores de Nginx.
- **Mis sensores:** Sensores activos con su estado (online/offline/pendiente), amenazas detectadas, paquetes procesados.
- **Asignar a assets:** Vincula sensores con los assets que monitorizan.
- **Agente descargable:** Boton para descargar el agente EDR multiplataforma (Linux, Windows, macOS).

**Como usarlo:** Ve al catalogo, despliega los sensores que necesites. Para endpoints remotos, descarga el agente EDR e instalalo en los equipos. Asigna cada sensor a los assets que protege.

---

## 7. Alerts (Reglas de Alerta)

**Ruta:** `/alerts`
**Permiso:** `alerts:read`

Configuracion de reglas de notificacion.

- **Crear regla:** Define condiciones (tipo de amenaza, severidad minima, IP especifica).
- **Canales:** Email, Slack webhook.
- **Activar/desactivar** reglas individuales.
- **Ejemplos:** "Notificar por Slack cuando severidad >= 8", "Email al equipo si hay brute_force desde IP externa".

**Como usarlo:** Crea reglas para los escenarios mas criticos. Asi tu equipo sera notificado inmediatamente cuando algo importante ocurra sin tener que estar mirando el dashboard constantemente.

---

## 8. AI Agent (Decisiones IA)

**Ruta:** `/ai-decisions`
**Permiso:** `ai_agent:read`

El agente autonomo de IA analiza amenazas y toma decisiones automaticas.

- **Decisiones automaticas:** Bloqueo de IPs, creacion de incidentes, reduccion de ruido.
- **Historial:** Cada decision con su razonamiento explicado por la IA.
- **Tipos de accion:**
  - `BLOCK_IP` — Bloquea una IP maliciosa automaticamente.
  - `CREATE_INCIDENT` — Escala amenazas criticas a incidente.
  - `SUPPRESS_NOISE` — Marca amenazas repetitivas como ruido.
  - `ALERT` — Genera alertas sin accion automatica.
- **Confianza:** Cada decision tiene un score de confianza (0-100%).

**Como usarlo:** Revisa las decisiones de la IA periodicamente. Si ves falsos positivos, ajusta los umbrales en Settings. La IA aprende del feedback del equipo.

---

## 9. AI Evolution

**Ruta:** `/ai-evolution`
**Permiso:** `ai_agent:read`

Seguimiento de como la IA mejora con el tiempo.

- **Metricas de evolucion:** Precision, tasa de falsos positivos, incidentes estudiados.
- **Estudios de incidentes:** La IA analiza incidentes resueltos para aprender patrones.
- **Patrones aprendidos:** Lista de patrones que la IA ha identificado.
- **Recomendaciones:** Sugerencias de mejora basadas en el analisis.

**Como usarlo:** Consulta esta seccion para ver como mejora la IA. Cuantos mas incidentes resuelvas y documentes, mejor sera la IA en futuras detecciones.

---

## 10. Threat Hunting

**Ruta:** `/hunting`
**Permiso:** `threats:read`

Busqueda proactiva de amenazas en los datos historicos.

- **Busqueda por IP:** Encuentra todas las amenazas asociadas a una IP especifica.
- **Busqueda por tipo:** Filtra por tipo de amenaza en todo el historial.
- **Correlacion temporal:** Ve patrones de ataque a lo largo del tiempo.
- **Enriquecimiento:** Consulta fuentes de Threat Intelligence (VirusTotal, Shodan, GreyNoise, OTX) directamente.

**Como usarlo:** Cuando sospechas de una IP o un patron, usa Threat Hunting para investigar. Busca la IP sospechosa y la plataforma te mostrara todo su historial y lo que dicen las fuentes de inteligencia.

---

## 11. SIGMA Rules

**Ruta:** `/sigma`
**Permiso:** `threats:read`

Gestion de reglas SIGMA para deteccion de amenazas.

- **Crear reglas SIGMA:** En formato YAML estandar.
- **Campos:** Titulo, descripcion, nivel de severidad, plataforma, fuente de log.
- **Activar/desactivar** reglas.
- **Importar reglas** de la comunidad SIGMA.

**Como usarlo:** Crea reglas SIGMA personalizadas para detectar amenazas especificas de tu entorno. Las reglas se ejecutan contra los datos de los sensores en tiempo real.

---

## 12. UEBA

**Ruta:** `/ueba`
**Permiso:** `threats:read`

Analisis de comportamiento de usuarios y entidades (User and Entity Behavior Analytics).

- **Perfiles de comportamiento:** Linea base de actividad normal por usuario/entidad.
- **Anomalias:** Deteccion de desviaciones del comportamiento normal.
- **Score de riesgo:** Puntuacion de riesgo por usuario basada en anomalias acumuladas.
- **Tipos de anomalia:** Login fuera de horario, acceso desde ubicacion inusual, volumen de datos anormal.

**Como usarlo:** UEBA detecta automaticamente comportamientos anomalos. Revisa los usuarios con score alto — pueden indicar cuentas comprometidas o amenazas internas.

---

## 13. Infrastructure

**Ruta:** `/infrastructure`
**Permiso:** `dashboard:read`

Monitoreo del estado de la infraestructura del SOC.

- **Servicios monitoreados:** Estado de cada componente (MySQL, Redis, Elasticsearch, MinIO, etc.).
- **Metricas del sistema:** CPU, memoria, disco de los servicios.
- **Alertas de infraestructura:** Servicios caidos, espacio en disco bajo, alta latencia.

**Como usarlo:** Revisa esta seccion si el SOC parece lento o si algun sensor deja de reportar. Aqui veras si algun servicio backend esta caido.

---

## 14. MITRE ATT&CK

**Ruta:** `/mitre`
**Permiso:** `mitre:read`

Mapeo de amenazas al framework MITRE ATT&CK.

- **Matriz visual:** Tacticas y tecnicas del framework MITRE con las que se han detectado amenazas.
- **Cobertura:** Ve que tacticas estan cubiertas por tus sensores y cuales no.
- **Detalle por tecnica:** Haz clic en una tecnica para ver las amenazas asociadas.

**Como usarlo:** Usa la matriz para identificar gaps en tu cobertura. Si ves tacticas sin detecciones (columnas vacias), necesitas agregar sensores o reglas para esas areas.

---

## 15. Audits (Auditorias)

**Ruta:** `/audits`
**Permiso:** `audits:read`

Gestion de auditorias de seguridad internas y externas.

- **Crear auditoria:** Titulo, tipo (interna/externa), alcance, fecha.
- **Detalle** (`/audits/:id`):
  - Timeline de progreso.
  - Hallazgos (findings) con severidad.
  - Avance de estado: Planificacion → En curso → Revision → Completada.
- **Agregar findings:** Documenta cada hallazgo con titulo, descripcion, severidad y recomendacion.

**Como usarlo:** Antes de una auditoria, crea el registro. Conforme avanza, agrega los hallazgos. Esto mantiene un historial centralizado de todas las auditorias.

---

## 16. Pentests

**Ruta:** `/pentests`
**Permiso:** `pentests:read`

Gestion de pruebas de penetracion.

- **Crear pentest:** Titulo, tipo (interno/externo/webapp/social engineering), alcance, fechas.
- **Detalle** (`/pentests/:id`):
  - Progreso por fases.
  - Findings con severidad y evidencia.
  - Estado: Planificacion → Reconocimiento → Explotacion → Post-explotacion → Reporte.
- **Agregar findings:** Vulnerabilidades encontradas con titulo, descripcion, severidad, evidencia.

**Como usarlo:** Registra cada pentest realizado. Documenta los findings como se vayan descubriendo. Al finalizar, tendras un reporte completo.

---

## 17. Vulnerabilities

**Ruta:** `/vulnerabilities`
**Permiso:** `vulnerabilities:read`

Seguimiento de vulnerabilidades conocidas.

- **Reportar vulnerabilidad:** Titulo, descripcion, severidad (CVSS), asset afectado.
- **Detalle** (`/vulnerabilities/:id`):
  - Estado: Reportada → Confirmada → En remediacion → Resuelta.
  - Timeline de cambios.
- **Filtros:** Por severidad, estado, asset.

**Como usarlo:** Cuando se detecta una vulnerabilidad (por pentest, scan, o reporte externo), registrala aqui. Asigna la remediacion y haz seguimiento hasta que se resuelva.

---

## 18. Certifications

**Ruta:** `/certifications`
**Permiso:** `certifications:read`

Gestion de certificaciones de seguridad y compliance.

- **Emitir certificacion:** Titulo, tipo (ISO 27001, SOC 2, PCI DSS, etc.), fecha de emision/expiracion.
- **Estado:** Activa, en proceso, expirada.
- **Metricas SOC:** Dashboard de metricas de cumplimiento agregadas.

**Como usarlo:** Registra las certificaciones de la organizacion. La plataforma te alertara cuando una certificacion este proxima a expirar.

---

## 19. Users (Usuarios)

**Ruta:** `/users`
**Permiso:** `users:read`

Gestion de usuarios del SOC.

- **Crear usuario:** Nombre, email, rol asignado.
- **Editar:** Cambiar rol, activar/desactivar cuenta.
- **Roles asignables:** Los definidos en la seccion de Roles.

**Como usarlo:** Crea cuentas para cada miembro del equipo SOC. Asigna roles segun sus responsabilidades (analista, admin, viewer).

---

## 20. Roles

**Ruta:** `/roles`
**Permiso:** `roles:read`

Gestion de roles y permisos (RBAC).

- **Roles predefinidos:** SuperAdmin, Admin, SOC Analyst, SOC Manager, Viewer.
- **Crear roles personalizados:** Define exactamente que permisos tiene cada rol.
- **Permisos granulares:** dashboard:read, threats:read, incidents:write, users:manage, etc.

**Como usarlo:** Usa los roles predefinidos o crea roles personalizados. Por ejemplo, un "Auditor externo" que solo pueda ver auditorias y vulnerabilidades.

---

## 21. Integrations

**Ruta:** `/integrations`
**Permiso:** `integrations:read`

Conexiones con servicios externos.

- **Threat Intelligence:**
  - VirusTotal — Reputacion de IPs, dominios y hashes.
  - Shodan — Informacion de puertos y servicios expuestos.
  - GreyNoise — Identifica IPs de escaneo masivo vs ataques dirigidos.
  - AlienVault OTX — Indicadores de compromiso (IoCs).
- **Notificaciones:**
  - Slack — Webhooks para alertas.
  - Email — Notificaciones por correo.
- **Configuracion:** Introduce tu API key para cada servicio y activalo.

**Como usarlo:** Configura al menos una fuente de Threat Intelligence (VirusTotal es la mas comun). Esto enriquece automaticamente las amenazas con contexto externo.

---

## 22. Marketplace

**Ruta:** `/marketplace`
**Permiso:** `settings:read`

Tienda de extensiones para el SOC.

- **Tipos:** Playbooks, reglas SIGMA, integraciones, dashboards.
- **Instalar/desinstalar** extensiones.
- **Ratings y reviews** de la comunidad.

**Como usarlo:** Explora las extensiones disponibles. Instala las que complementen tu setup de seguridad.

---

## 23. Billing (Facturacion)

**Ruta:** `/billing`
**Permiso:** `billing:read`

Gestion de suscripcion y pagos (via Stripe).

- **Plan actual:** Starter, Professional, Enterprise.
- **Uso:** Consumo de recursos vs limites del plan.
- **Facturas:** Historial de pagos.
- **Cambiar plan:** Upgrade/downgrade.

**Como usarlo:** Revisa tu plan actual y si necesitas mas capacidad, haz upgrade. Las facturas se envian automaticamente por email.

---

## 24. Settings (Configuracion)

**Ruta:** `/settings`

Configuracion general de la cuenta y la plataforma.

- **Perfil:** Cambiar nombre, email.
- **Seguridad:**
  - Cambiar contrasena.
  - MFA (autenticacion de dos factores) — Activar/desactivar TOTP.
- **API Keys:**
  - Crear API keys para sensores y agentes.
  - Revocar, rotar o eliminar keys.
  - **Aqui se generan las keys para instalar el agente EDR.**
- **SSO:** Configuracion de Single Sign-On.
- **Data Retention:** Politicas de retencion de datos.

**Como usarlo:** Lo primero que debes hacer es activar MFA. Luego, genera una API key para conectar tus sensores y agentes.

---

## 25. AI Chat Assistant

**Ubicacion:** Boton flotante (esquina inferior derecha)

Asistente de IA integrado en toda la plataforma.

- **Preguntas en lenguaje natural:** "Que IPs han atacado mas en las ultimas 24h?", "Resume los incidentes criticos abiertos".
- **Analisis de amenazas:** Pide a la IA que analice una amenaza especifica.
- **Recomendaciones:** La IA sugiere acciones basadas en el contexto actual.

**Como usarlo:** Haz clic en el boton del chat en cualquier momento. Escribe tu pregunta y la IA respondera con datos del SOC en tiempo real.

---

## 26. SuperAdmin Panel

**Acceso:** Solo usuarios con rol SuperAdmin

Panel de administracion global para gestionar multiples empresas.

- **Global Overview** (`/`): Metricas de todas las empresas.
- **Companies** (`/superadmin/companies`): Lista de empresas registradas, gestion.
- **Company Detail** (`/superadmin/company/:id`): Detalle de una empresa especifica.
- **Onboarding** (`/superadmin/onboarding`): Solicitudes de registro de nuevas empresas.
- **Bot Dashboard** (`/superadmin/bot`): Estado del prospector de LinkedIn y automatizaciones.

**Como usarlo:** Si eres el administrador de la plataforma, aqui gestionas todas las empresas clientes.

---

## 27. Agente EDR Descargable

**Descarga desde:** Sensores → Boton "Descargar Agente"

Agente EDR multiplataforma que se instala en endpoints remotos.

### Plataformas soportadas
- **Linux** (Ubuntu, Debian, RHEL, CentOS)
- **Windows** (10, 11, Server 2016+)
- **macOS** (12+)

### Capacidades
- File Integrity Monitoring (FIM)
- Monitoreo de logs de autenticacion
- Deteccion de procesos sospechosos y reverse shells
- Monitoreo de conexiones de red (C2 beacons)
- Monitoreo de salud del sistema

### Instalacion

**Requisitos previos:**
1. Python 3.8+
2. SOC URL: `https://soc.blackwolfsec.io/api/v1`
3. API Key: Generarla en Settings → API Keys
4. Company ID: Visible en Settings o en el README del ZIP

**Linux:**
```bash
unzip blackwolf-agent.zip
cd blackwolf-agent
sudo ./install.sh --url https://soc.blackwolfsec.io/api/v1 --key TU_API_KEY --company TU_COMPANY_ID
```

**macOS:**
```bash
unzip blackwolf-agent.zip
cd blackwolf-agent
sudo ./install-mac.sh --url https://soc.blackwolfsec.io/api/v1 --key TU_API_KEY --company TU_COMPANY_ID
```

**Windows (PowerShell como Administrador):**
```powershell
Expand-Archive blackwolf-agent.zip
cd blackwolf-agent
.\install.ps1 -SocUrl https://soc.blackwolfsec.io/api/v1 -ApiKey TU_API_KEY -CompanyId TU_COMPANY_ID
```

### Gestion post-instalacion

| | Linux | macOS | Windows |
|---|---|---|---|
| **Estado** | `systemctl status blackwolf-agent` | `launchctl list \| grep blackwolf` | `Get-ScheduledTask -TaskName BlackWolfAgent` |
| **Logs** | `journalctl -u blackwolf-agent -f` | `tail -f /var/log/blackwolf-agent.log` | Event Viewer |
| **Reiniciar** | `systemctl restart blackwolf-agent` | `sudo launchctl unload/load` plist | `Stop/Start-ScheduledTask` |
| **Desinstalar** | `sudo ./uninstall.sh` | `sudo ./uninstall-mac.sh` | `.\uninstall.ps1` |

---

## Flujo de Trabajo Recomendado

1. **Setup inicial:**
   - Activar MFA en Settings
   - Generar API Key en Settings
   - Registrar assets en Assets
   - Desplegar sensores del catalogo
   - Instalar agente EDR en endpoints

2. **Operacion diaria:**
   - Revisar Dashboard para vision general
   - Revisar Threats filtrando severidad >= 7
   - Gestionar Incidents abiertos
   - Consultar AI Decisions para ver acciones automaticas

3. **Investigacion:**
   - Usar Threat Hunting para investigar IPs sospechosas
   - Consultar MITRE ATT&CK para mapear tacticas
   - Usar UEBA para detectar comportamiento anomalo

4. **Mejora continua:**
   - Revisar AI Evolution para ver patrones aprendidos
   - Crear/ajustar Playbooks segun incidentes recurrentes
   - Configurar SIGMA Rules personalizadas
   - Revisar cobertura en MITRE ATT&CK
