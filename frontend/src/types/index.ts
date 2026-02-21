// ===== User Management =====

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  role: string;
  companyId: string | null;
  active: boolean;
  createdAt: string;
  lastLogin: string | null;
}

// ===== Existing Entities =====

export interface ThreatEvent {
  id: string;
  companyId: string;
  sensorId: string;
  threatType: string;
  severity: number;
  srcIp: string;
  dstIp: string;
  dstPort: number;
  timestamp: string;
  status: string;
  description: string;
}

export interface Sensor {
  id: string;
  name: string;
  companyId: string;
  status: string;
  registeredAt: string;
  lastSeen: string;
  packetsProcessed: number;
  threatsDetected: number;
}

export interface ThreatListResponse {
  content: ThreatEvent[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

// ===== SOC Entities =====

export interface SecurityAudit {
  id: string;
  companyId: string;
  title: string;
  auditType: string;
  status: AuditStatus;
  scope: string;
  methodology: string;
  leadAuditor: string;
  startDate: string;
  endDate: string;
  executiveSummary: string;
  createdAt: string;
  updatedAt: string;
}

export type AuditStatus = 'SCOPING' | 'SCANNING' | 'TESTING' | 'REPORTING' | 'DELIVERED';

export interface AuditFinding {
  id: string;
  title: string;
  riskLevel: RiskLevel;
  cvssScore: number;
  affectedAsset: string;
  status: string;
  createdAt: string;
}

export interface AuditDetailResponse extends SecurityAudit {
  findings: AuditFinding[];
}

export interface PenetrationTest {
  id: string;
  companyId: string;
  title: string;
  testType: PentestType;
  status: PentestStatus;
  scope: string;
  rulesOfEngagement: string;
  targetSystems: string;
  tester: string;
  startDate: string;
  endDate: string;
  executiveSummary: string;
  createdAt: string;
  updatedAt: string;
}

export type PentestType = 'BLACK_BOX' | 'GREY_BOX' | 'WHITE_BOX';
export type PentestStatus = 'PLANNING' | 'RECONNAISSANCE' | 'EXPLOITATION' | 'POST_EXPLOITATION' | 'REPORTING' | 'DELIVERED';

export interface PentestFinding {
  id: string;
  title: string;
  severity: string;
  cvssScore: number;
  affectedComponent: string;
  status: string;
  createdAt: string;
}

export interface PentestDetailResponse extends PenetrationTest {
  findings: PentestFinding[];
}

export interface Vulnerability {
  id: string;
  companyId: string;
  title: string;
  description: string;
  cveId: string;
  riskLevel: RiskLevel;
  cvssScore: number;
  affectedAsset: string;
  status: VulnerabilityStatus;
  remediationPlan: string;
  remediationDeadline: string;
  verifiedAt: string;
  detectedAt: string;
  updatedAt: string;
}

export type VulnerabilityStatus = 'DETECTED' | 'CONFIRMED' | 'IN_REMEDIATION' | 'FIXED' | 'VERIFIED';
export type RiskLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';

export interface VulnerabilityDashboard {
  total: number;
  detected: number;
  confirmed: number;
  inRemediation: number;
  fixed: number;
  verified: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
}

export interface SecurityCertification {
  id: string;
  companyId: string;
  certificationType: string;
  title: string;
  status: 'PENDING' | 'ACTIVE' | 'EXPIRED' | 'REVOKED';
  issuedAt: string;
  expiresAt: string;
  auditId: string;
  issuedBy: string;
  notes: string;
  createdAt: string;
}

export interface SocMetricsResponse {
  totalAudits: number;
  completedAudits: number;
  totalPentests: number;
  completedPentests: number;
  openVulnerabilities: number;
  fixedVulnerabilities: number;
  activeCertifications: number;
  avgRemediationDays: number;
  auditDeliveryDays: number;
  recentMetrics: MetricEntry[];
}

export interface MetricEntry {
  name: string;
  value: number;
  unit: string;
  target: number;
  period: string;
  recordedAt: string;
}

export interface ActivityLog {
  id: string;
  companyId: string;
  entityType: string;
  entityId: string;
  action: string;
  performedBy: string;
  details: string;
  createdAt: string;
}

// ===== Incidents =====

export interface Incident {
  id: string;
  companyId: string;
  title: string;
  description: string;
  severity: string;
  status: string;
  assignedTo: string | null;
  sourceThreatId: string | null;
  slaDeadline: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
}

export interface IncidentTimeline {
  id: string;
  incidentId: string;
  action: string;
  description: string;
  performedBy: string;
  createdAt: string;
}

export interface IncidentDetailResponse {
  incident: Incident;
  timeline: IncidentTimeline[];
}

// ===== Alerts =====

export interface AlertConfiguration {
  id: string;
  companyId: string;
  alertType: string;
  destination: string;
  minSeverity: number;
  active: boolean;
  createdAt: string;
}

export interface AlertHistory {
  id: string;
  companyId: string;
  alertConfigId: string;
  threatEventId: string | null;
  incidentId: string | null;
  alertType: string;
  destination: string;
  subject: string;
  message: string;
  status: string;
  sentAt: string;
}

// ===== Onboarding =====

export interface OnboardingRequest {
  id: string;
  companyName: string;
  domain: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  acceptsTerms: boolean;
  acceptsDpa: boolean;
  acceptsNda: boolean;
  monitorNetwork: boolean;
  monitorEndpoints: boolean;
  monitorCloud: boolean;
  monitorEmail: boolean;
  numServers: number;
  numEndpoints: number;
  numLocations: number;
  currentSecurityTools: string;
  additionalNotes: string;
  alertEmail: string;
  alertSlackWebhook: string;
  preferredSla: string;
  status: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

// ===== AI Chat =====

export interface ChatMessageType {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

export interface ChatResponse {
  sessionId: string;
  messageId: string;
  content: string;
  tokensUsed: number;
}

export interface ChatSessionSummary {
  id: string;
  title: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChatHistoryResponse {
  sessionId: string;
  title: string;
  messages: ChatMessageType[];
}

// ===== MITRE Coverage =====

export interface MitreCoverageItem {
  techniqueId: string;
  techniqueName: string;
  tactic: string;
  hitCount: number;
  lastSeen: string | null;
}

// ===== Threat Enrichment =====

export interface ThreatEnrichment {
  ip: string;
  abuseConfidenceScore: number;
  countryCode: string;
  isp: string;
  domain: string;
  tor: boolean;
  vpn: boolean;
  totalReports: number;
  enrichedAt: string;
}
