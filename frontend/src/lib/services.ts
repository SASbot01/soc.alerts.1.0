import api from './api';
import type {
  ThreatListResponse,
  Sensor,
  SecurityAudit,
  AuditDetailResponse,
  PenetrationTest,
  PentestDetailResponse,
  Vulnerability,
  VulnerabilityDashboard,
  SecurityCertification,
  SocMetricsResponse,
  ActivityLog,
  UserProfile,
  Incident,
  IncidentDetailResponse,
  AlertConfiguration,
  AlertHistory,
  OnboardingRequest,
  ChatResponse,
  ChatSessionSummary,
  ChatHistoryResponse,
  MitreCoverageItem,
} from '../types';

// ===== User Management =====

export const userService = {
  list: () => api.get<UserProfile[]>('/users').then(r => r.data),

  create: (data: { email: string; fullName: string; role: string; password: string }) =>
    api.post<UserProfile>('/users', data).then(r => r.data),

  update: (id: string, data: { fullName?: string; role?: string; isActive?: boolean }) =>
    api.put<UserProfile>(`/users/${id}`, data).then(r => r.data),

  delete: (id: string) =>
    api.delete(`/users/${id}`).then(r => r.data),
};

// ===== Superadmin =====

export const superAdminService = {
  getDashboard: () =>
    api.get('/superadmin/dashboard').then(r => r.data),

  getCompanies: () =>
    api.get('/superadmin/companies').then(r => r.data),

  getCompanyDashboard: (companyId: string) =>
    api.get(`/superadmin/companies/${companyId}/dashboard`).then(r => r.data),
};

// ===== Threats =====

export const threatService = {
  list: (params?: Record<string, string | number>) =>
    api.get<ThreatListResponse>('/threats', { params }).then(r => r.data),

  updateStatus: (id: string, status: string) =>
    api.patch(`/threats/${id}/status`, { status }).then(r => r.data),
};

// ===== Sensors =====

export const sensorService = {
  list: () => api.get<Sensor[]>('/sensors').then(r => r.data),

  getDetail: (id: string) =>
    api.get(`/sensors/${id}`).then(r => r.data),

  listCatalog: () =>
    api.get('/sensors/catalog').then(r => r.data),

  deploy: (data: { templateId: string; customName?: string }) =>
    api.post('/sensors/catalog/deploy', data).then(r => r.data),

  remove: (id: string) =>
    api.delete(`/sensors/${id}`).then(r => r.data),

  assignToAsset: (data: { sensorId: string; assetId: string }) =>
    api.post('/sensors/assignments', data).then(r => r.data),

  bulkAssign: (data: { sensorId: string; assetIds: string[] }) =>
    api.post('/sensors/assignments/bulk', data).then(r => r.data),

  unassignFromAsset: (sensorId: string, assetId: string) =>
    api.delete(`/sensors/assignments/${sensorId}/${assetId}`).then(r => r.data),

  getAssignments: (sensorId: string) =>
    api.get(`/sensors/${sensorId}/assignments`).then(r => r.data),
};

// ===== Audits =====

export const auditService = {
  list: () => api.get<SecurityAudit[]>('/audits').then(r => r.data),

  getDetail: (id: string) =>
    api.get<AuditDetailResponse>(`/audits/${id}`).then(r => r.data),

  create: (data: Record<string, unknown>) =>
    api.post<SecurityAudit>('/audits', data).then(r => r.data),

  updateStatus: (id: string, data: { status: string; executiveSummary?: string }) =>
    api.patch<SecurityAudit>(`/audits/${id}/status`, data).then(r => r.data),

  addFinding: (auditId: string, data: Record<string, unknown>) =>
    api.post(`/audits/${auditId}/findings`, data).then(r => r.data),

  updateFindingStatus: (findingId: string, status: string) =>
    api.patch(`/audits/findings/${findingId}/status`, { status }).then(r => r.data),

  getActivity: (id: string) =>
    api.get<ActivityLog[]>(`/audits/${id}/activity`).then(r => r.data),
};

// ===== Pentests =====

export const pentestService = {
  list: () => api.get<PenetrationTest[]>('/pentests').then(r => r.data),

  getDetail: (id: string) =>
    api.get<PentestDetailResponse>(`/pentests/${id}`).then(r => r.data),

  create: (data: Record<string, unknown>) =>
    api.post<PenetrationTest>('/pentests', data).then(r => r.data),

  updateStatus: (id: string, data: { status: string; executiveSummary?: string }) =>
    api.patch<PenetrationTest>(`/pentests/${id}/status`, data).then(r => r.data),

  addFinding: (pentestId: string, data: Record<string, unknown>) =>
    api.post(`/pentests/${pentestId}/findings`, data).then(r => r.data),
};

// ===== Vulnerabilities =====

export const vulnerabilityService = {
  list: () => api.get<Vulnerability[]>('/vulnerabilities').then(r => r.data),

  getDetail: (id: string) =>
    api.get<Vulnerability>(`/vulnerabilities/${id}`).then(r => r.data),

  create: (data: Record<string, unknown>) =>
    api.post<Vulnerability>('/vulnerabilities', data).then(r => r.data),

  updateStatus: (id: string, data: { status: string; remediationPlan?: string }) =>
    api.patch<Vulnerability>(`/vulnerabilities/${id}/status`, data).then(r => r.data),

  getDashboard: () =>
    api.get<VulnerabilityDashboard>('/vulnerabilities/dashboard').then(r => r.data),
};

// ===== Certifications =====

export const certificationService = {
  list: () => api.get<SecurityCertification[]>('/certifications').then(r => r.data),

  getDetail: (id: string) =>
    api.get<SecurityCertification>(`/certifications/${id}`).then(r => r.data),

  checkEligibility: (auditId: string) =>
    api.get<{ eligible: boolean }>(`/certifications/eligibility/${auditId}`).then(r => r.data),

  issue: (data: Record<string, unknown>) =>
    api.post<SecurityCertification>('/certifications', data).then(r => r.data),

  revoke: (id: string) =>
    api.patch<SecurityCertification>(`/certifications/${id}/revoke`).then(r => r.data),

  getMetrics: () =>
    api.get<SocMetricsResponse>('/certifications/metrics').then(r => r.data),
};

// ===== Incidents =====

export const incidentService = {
  list: () => api.get<Incident[]>('/incidents').then(r => r.data),

  getDetail: (id: string) =>
    api.get<IncidentDetailResponse>(`/incidents/${id}`).then(r => r.data),

  create: (data: { title: string; description: string; severity: string; assignedTo?: string; sourceThreatId?: string }) =>
    api.post<Incident>('/incidents', data).then(r => r.data),

  update: (id: string, data: { status?: string; assignedTo?: string; description?: string }) =>
    api.put<Incident>(`/incidents/${id}`, data).then(r => r.data),

  addTimeline: (id: string, data: { action: string; description: string }) =>
    api.post(`/incidents/${id}/timeline`, data).then(r => r.data),
};

// ===== Alerts =====

export const alertService = {
  listConfigs: () => api.get<AlertConfiguration[]>('/alerts/config').then(r => r.data),

  createConfig: (data: { alertType: string; destination: string; minSeverity?: number }) =>
    api.post<AlertConfiguration>('/alerts/config', data).then(r => r.data),

  updateConfig: (id: string, data: { destination?: string; minSeverity?: number; isActive?: boolean }) =>
    api.put<AlertConfiguration>(`/alerts/config/${id}`, data).then(r => r.data),

  deleteConfig: (id: string) =>
    api.delete(`/alerts/config/${id}`).then(r => r.data),

  getHistory: () => api.get<AlertHistory[]>('/alerts/history').then(r => r.data),
};

// ===== Onboarding =====

export const onboardingService = {
  submit: (data: Record<string, unknown>) =>
    api.post<OnboardingRequest>('/onboarding/submit', data).then(r => r.data),

  listAll: () => api.get<OnboardingRequest[]>('/onboarding/requests').then(r => r.data),

  listPending: () => api.get<OnboardingRequest[]>('/onboarding/requests/pending').then(r => r.data),

  review: (id: string, status: string) =>
    api.put(`/onboarding/requests/${id}/review`, { status }).then(r => r.data),
};

// ===== AI Chat =====

export const chatService = {
  sendMessage: (data: { message: string; sessionId?: string }) =>
    api.post<ChatResponse>('/chat/send', data).then(r => r.data),

  listSessions: () =>
    api.get<ChatSessionSummary[]>('/chat/sessions').then(r => r.data),

  getSessionHistory: (sessionId: string) =>
    api.get<ChatHistoryResponse>(`/chat/sessions/${sessionId}`).then(r => r.data),

  deleteSession: (sessionId: string) =>
    api.delete(`/chat/sessions/${sessionId}`).then(r => r.data),
};

// ===== Playbooks =====

export const playbookService = {
  list: () => api.get('/playbooks').then(r => r.data),

  getDetail: (id: string) =>
    api.get(`/playbooks/${id}`).then(r => r.data),

  create: (data: Record<string, unknown>) =>
    api.post('/playbooks', data).then(r => r.data),

  toggleActive: (id: string) =>
    api.patch(`/playbooks/${id}/toggle`).then(r => r.data),

  execute: (id: string) =>
    api.post(`/playbooks/${id}/execute`).then(r => r.data),

  getExecutions: () =>
    api.get('/playbooks/executions').then(r => r.data),

  getExecutionDetail: (id: string) =>
    api.get(`/playbooks/executions/${id}`).then(r => r.data),

  listTemplates: () =>
    api.get('/playbooks/templates').then(r => r.data),

  deployTemplate: (data: { templateId: string; activateImmediately: boolean }) =>
    api.post('/playbooks/templates/deploy', data).then(r => r.data),

  assignToAsset: (data: { playbookId: string; assetId: string; priority?: number }) =>
    api.post('/playbooks/assignments', data).then(r => r.data),

  bulkAssign: (data: { playbookId: string; assetIds: string[] }) =>
    api.post('/playbooks/assignments/bulk', data).then(r => r.data),

  unassignFromAsset: (playbookId: string, assetId: string) =>
    api.delete(`/playbooks/assignments/${playbookId}/${assetId}`).then(r => r.data),

  getPlaybookAssignments: (playbookId: string) =>
    api.get(`/playbooks/${playbookId}/assignments`).then(r => r.data),

  getGraph: (playbookId: string) =>
    api.get(`/playbooks/${playbookId}/graph`).then(r => r.data),

  saveGraph: (playbookId: string, graphData: { nodes: unknown[]; edges: unknown[] }) =>
    api.put(`/playbooks/${playbookId}/graph`, graphData).then(r => r.data),
};

// ===== Assets =====

export const assetService = {
  list: (params?: Record<string, string>) =>
    api.get('/assets', { params }).then(r => r.data),

  getDetail: (id: string) =>
    api.get(`/assets/${id}`).then(r => r.data),

  create: (data: Record<string, unknown>) =>
    api.post('/assets', data).then(r => r.data),

  update: (id: string, data: Record<string, unknown>) =>
    api.put(`/assets/${id}`, data).then(r => r.data),

  delete: (id: string) =>
    api.delete(`/assets/${id}`).then(r => r.data),

  getDashboard: () =>
    api.get('/assets/dashboard').then(r => r.data),
};

// ===== MITRE ATT&CK =====

export const mitreService = {
  listTechniques: () =>
    api.get('/mitre/techniques').then(r => r.data),

  getMappings: (threatId: string) =>
    api.get(`/mitre/threat/${threatId}/mappings`).then(r => r.data),

  mapThreat: (threatId: string, techniqueId: string, confidence: number) =>
    api.post(`/mitre/threat/${threatId}/map`, { techniqueId, confidence }).then(r => r.data),

  getCoverage: () =>
    api.get<MitreCoverageItem[]>('/mitre/coverage').then(r => r.data),

  getIncidentMappings: (incidentId: string) =>
    api.get(`/mitre/incident/${incidentId}/mappings`).then(r => r.data),
};

// ===== AI Agent =====

export const aiAgentService = {
  getStats: () =>
    api.get('/ai-agent/autonomous/stats').then(r => r.data),

  getDecisions: (verdict?: string) =>
    api.get('/ai-agent/autonomous/decisions', { params: verdict ? { verdict } : {} }).then(r => r.data),

  getTokenStats: () =>
    api.get('/ai-agent/autonomous/token-stats').then(r => r.data),
};

// ===== Integrations =====

export const integrationService = {
  list: () =>
    api.get('/integrations').then(r => r.data),

  getOverview: () =>
    api.get('/integrations/overview').then(r => r.data),

  getProviders: () =>
    api.get('/integrations/providers').then(r => r.data),

  save: (data: Record<string, unknown>) =>
    api.post('/integrations', data).then(r => r.data),

  toggle: (id: string) =>
    api.post(`/integrations/${id}/toggle`).then(r => r.data),

  test: (id: string) =>
    api.post(`/integrations/${id}/test`).then(r => r.data),

  delete: (id: string) =>
    api.delete(`/integrations/${id}`).then(r => r.data),

  createTicket: (integrationId: string, incidentId: string) =>
    api.post(`/integrations/${integrationId}/ticket/${incidentId}`).then(r => r.data),

  pageIncident: (integrationId: string, incidentId: string) =>
    api.post(`/integrations/${integrationId}/page/${incidentId}`).then(r => r.data),

  getTickets: (incidentId: string) =>
    api.get(`/integrations/tickets/${incidentId}`).then(r => r.data),
};

// ===== Threat Intel =====

export const threatIntelService = {
  getEnrichment: (ip: string) =>
    api.get(`/threats/enrichment/${ip}`).then(r => r.data),

  enrichIp: (ip: string) =>
    api.post(`/threats/enrich/${ip}`).then(r => r.data),
};

// ===== Billing =====

export const billingService = {
  getOverview: () =>
    api.get('/billing/overview').then(r => r.data),

  getPlans: () =>
    api.get('/billing/plans').then(r => r.data),

  createCheckout: (plan: string) =>
    api.post('/billing/checkout', { plan }).then(r => r.data),

  changePlan: (newPlan: string) =>
    api.post('/billing/change-plan', { newPlan }).then(r => r.data),

  cancel: () =>
    api.post('/billing/cancel').then(r => r.data),

  reactivate: () =>
    api.post('/billing/reactivate').then(r => r.data),

  createPortal: () =>
    api.post('/billing/portal').then(r => r.data),
};

// ===== API Keys =====

export const apiKeyService = {
  list: () =>
    api.get('/api-keys').then(r => r.data),

  create: (data: { name: string; scopes?: string }) =>
    api.post('/api-keys', data).then(r => r.data),

  revoke: (id: string) =>
    api.post(`/api-keys/${id}/revoke`).then(r => r.data),

  rotate: (id: string) =>
    api.post(`/api-keys/${id}/rotate`).then(r => r.data),

  delete: (id: string) =>
    api.delete(`/api-keys/${id}`).then(r => r.data),

  getRetentionLogs: () =>
    api.get('/api-keys/retention-logs').then(r => r.data),
};

// ===== SSO =====

export const ssoService = {
  checkSso: (domain: string) =>
    api.get('/sso/check', { params: { domain } }).then(r => r.data),

  authorize: (domain: string) =>
    api.post('/sso/authorize', { domain }).then(r => r.data),

  callback: (domain: string, code: string) =>
    api.post('/sso/callback', { domain, code }).then(r => r.data),

  getConfig: () =>
    api.get('/sso/config').then(r => r.data),

  saveConfig: (config: Record<string, unknown>) =>
    api.post('/sso/config', config).then(r => r.data),

  toggleActive: (active: boolean) =>
    api.post('/sso/config/toggle', { active }).then(r => r.data),

  deleteConfig: () =>
    api.delete('/sso/config').then(r => r.data),

  testConnection: (issuerUrl: string) =>
    api.post('/sso/test', { issuerUrl }).then(r => r.data),
};

// ===== Roles & Permissions =====

export const rbacService = {
  listRoles: () =>
    api.get('/roles').then(r => r.data),

  getRole: (id: string) =>
    api.get(`/roles/${id}`).then(r => r.data),

  listPermissions: () =>
    api.get('/roles/permissions').then(r => r.data),

  createRole: (data: { name: string; displayName: string; description: string; permissions: string[] }) =>
    api.post('/roles', data).then(r => r.data),

  updateRole: (id: string, data: { displayName?: string; description?: string; permissions?: string[] }) =>
    api.put(`/roles/${id}`, data).then(r => r.data),

  deleteRole: (id: string) =>
    api.delete(`/roles/${id}`).then(r => r.data),

  assignRole: (userId: string, role: string) =>
    api.post('/roles/assign', { userId, role }).then(r => r.data),
};

// ===== Reports =====

export const reportService = {
  downloadExecutivePDF: () =>
    api.get('/reports/executive', { responseType: 'blob' }).then(r => {
      const url = window.URL.createObjectURL(new Blob([r.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'blackwolf-executive-report.pdf');
      document.body.appendChild(link);
      link.click();
      link.remove();
    }),

  downloadThreatsCSV: () =>
    api.get('/reports/threats/csv', { responseType: 'blob' }).then(r => {
      const url = window.URL.createObjectURL(new Blob([r.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'threats-export.csv');
      document.body.appendChild(link);
      link.click();
      link.remove();
    }),

  downloadIncidentsCSV: () =>
    api.get('/reports/incidents/csv', { responseType: 'blob' }).then(r => {
      const url = window.URL.createObjectURL(new Blob([r.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'incidents-export.csv');
      document.body.appendChild(link);
      link.click();
      link.remove();
    }),

  downloadIncidentPDF: (incidentId: string) =>
    api.get(`/reports/incident/${incidentId}`, { responseType: 'blob' }).then(r => {
      const url = window.URL.createObjectURL(new Blob([r.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `incident-report-${incidentId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    }),
};

// ===== Threat Hunting =====

export const huntingService = {
  list: () => api.get('/hunting').then(r => r.data),

  get: (id: string) => api.get(`/hunting/${id}`).then(r => r.data),

  create: (data: any) => api.post('/hunting', data).then(r => r.data),

  update: (id: string, data: any) => api.put(`/hunting/${id}`, data).then(r => r.data),

  delete: (id: string) => api.delete(`/hunting/${id}`).then(r => r.data),

  execute: (id: string) => api.post(`/hunting/${id}/execute`).then(r => r.data),

  search: (query: any) => api.post('/hunting/search', query).then(r => r.data),

  aggregations: (field: string, timeRange: string = '24h') =>
    api.get(`/hunting/aggregations?field=${field}&timeRange=${timeRange}`).then(r => r.data),

  history: (id: string) => api.get(`/hunting/${id}/history`).then(r => r.data),
};
