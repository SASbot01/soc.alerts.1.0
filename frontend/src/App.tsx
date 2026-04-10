import React from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Login from './pages/Login';
import Landing from './pages/Landing';
import Dashboard from './pages/Dashboard';
import SOCHome from './pages/SOCHome';
import Sensors from './pages/Sensors';
import Threats from './pages/Threats';
import Audits from './pages/Audits';
import AuditDetail from './pages/AuditDetail';
import Pentests from './pages/Pentests';
import PentestDetail from './pages/PentestDetail';
import Vulnerabilities from './pages/Vulnerabilities';
import VulnerabilityDetail from './pages/VulnerabilityDetail';
import Certifications from './pages/Certifications';
import Incidents from './pages/Incidents';
import IncidentDetail from './pages/IncidentDetail';
import AlertConfig from './pages/AlertConfig';
import OnboardingRequests from './pages/OnboardingRequests';
import OnboardingWizard from './pages/OnboardingWizard';
import Settings from './pages/Settings';
import Users from './pages/Users';
import SuperAdminDashboard from './pages/SuperAdminDashboard';
import Companies from './pages/Companies';
import CompanyDetail from './pages/CompanyDetail';
import Playbooks from './pages/Playbooks';
import Assets from './pages/Assets';
import MitreMatrix from './pages/MitreMatrix';
import AiDecisions from './pages/AiDecisions';
import Billing from './pages/Billing';
import RoleManagement from './pages/RoleManagement';
import Pricing from './pages/Pricing';
import Integrations from './pages/Integrations';
import PlaybookBuilder from './pages/PlaybookBuilder';
import ThreatHunting from './pages/ThreatHunting';
import SigmaRules from './pages/SigmaRules';
import Ueba from './pages/Ueba';
import AiEvolution from './pages/AiEvolution';
import Infrastructure from './pages/Infrastructure';
import LogExplorer from './pages/LogExplorer';
import ThreatIntel from './pages/ThreatIntel';
import ComplianceDashboard from './pages/ComplianceDashboard';
import AttackSurface from './pages/AttackSurface';
import Forensics from './pages/Forensics';
import CloudSecurity from './pages/CloudSecurity';
import IdentityThreats from './pages/IdentityThreats';
import NetworkAnalysis from './pages/NetworkAnalysis';
import Deception from './pages/Deception';
import VulnScanner from './pages/VulnScanner';
import CepRules from './pages/CepRules';
import Layout from './components/Layout';
import MiniLayout from './components/MiniLayout';
import NotificationToast from './components/NotificationToast';
import { useAuth } from './context/AuthContext';

// ── Section path definitions ──
const monitorPaths = ['/threats', '/incidents', '/alerts'];
const securityPaths = ['/assets', '/vulnerabilities', '/audits', '/infrastructure', '/certifications'];
const aiPaths = ['/ai-decisions', '/ai-evolution', '/sensors', '/logs', '/hunting', '/sigma', '/ueba', '/cep'];
const responsePaths = ['/playbooks', '/forensics', '/deception'];
const networkPaths = ['/compliance', '/attack-surface', '/cloud-security', '/identity', '/network', '/vuln-scanner'];
const adminPaths = ['/users', '/roles', '/integrations', '/billing', '/settings'];
const standalonePaths = ['/mitre', '/threat-intel', '/pentests'];
const superadminPaths = ['/superadmin'];

// ── Tab definitions ──
const monitorTabs = [
  { to: '/threats', label: 'Amenazas' },
  { to: '/incidents', label: 'Incidentes' },
  { to: '/alerts', label: 'Alertas' },
];

const securityTabs = [
  { to: '/assets', label: 'Assets' },
  { to: '/vulnerabilities', label: 'Vulnerabilidades' },
  { to: '/audits', label: 'Auditorias' },
  { to: '/infrastructure', label: 'Infra' },
  { to: '/certifications', label: 'Certificaciones' },
];

const aiTabs = [
  { to: '/ai-decisions', label: 'AI Agent' },
  { to: '/ai-evolution', label: 'Evolución' },
  { to: '/sensors', label: 'Sensores' },
  { to: '/logs', label: 'Logs' },
  { to: '/hunting', label: 'Hunting' },
  { to: '/sigma', label: 'Sigma' },
  { to: '/ueba', label: 'UEBA' },
  { to: '/cep', label: 'CEP' },
];

const responseTabs = [
  { to: '/playbooks', label: 'Playbooks' },
  { to: '/forensics', label: 'Forensics' },
  { to: '/deception', label: 'Deception' },
];

const networkTabs = [
  { to: '/compliance', label: 'Compliance' },
  { to: '/attack-surface', label: 'Superficie' },
  { to: '/cloud-security', label: 'Cloud' },
  { to: '/identity', label: 'Identidad' },
  { to: '/network', label: 'Red' },
  { to: '/vuln-scanner', label: 'Scanner' },
];

const adminTabs = [
  { to: '/users', label: 'Usuarios' },
  { to: '/roles', label: 'Roles' },
  { to: '/integrations', label: 'Integraciones' },
  { to: '/billing', label: 'Billing' },
  { to: '/settings', label: 'Settings' },
];

// ── Protected Route ──
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <div className="h-screen flex items-center justify-center bg-slate-950 text-white">Loading...</div>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

// ── Dashboard Router ──
const DashboardRouter: React.FC = () => {
  const { user } = useAuth();
  if (user?.role === 'superadmin') return <SuperAdminDashboard />;
  return <SOCHome />;
};

// ── Section-based router inside Layout ──
const matchSection = (pathname: string, paths: string[]) =>
  paths.some(p => pathname === p || pathname.startsWith(p + '/'));

const SOCRouter: React.FC = () => {
  const { pathname } = useLocation();

  const isHome = pathname === '/';
  const isMonitor = matchSection(pathname, monitorPaths);
  const isSecurity = matchSection(pathname, securityPaths);
  const isAI = matchSection(pathname, aiPaths);
  const isResponse = matchSection(pathname, responsePaths);
  const isNetwork = matchSection(pathname, networkPaths);
  const isAdmin = matchSection(pathname, adminPaths);
  const isSuperAdmin = matchSection(pathname, superadminPaths);

  // Home page — no MiniLayout
  if (isHome) {
    return <DashboardRouter />;
  }

  // SuperAdmin routes — no MiniLayout
  if (isSuperAdmin) {
    return (
      <Routes>
        <Route path="superadmin/companies" element={<Companies />} />
        <Route path="superadmin/company/:id" element={<CompanyDetail />} />
        <Route path="superadmin/onboarding" element={<OnboardingRequests />} />
        <Route path="superadmin/onboarding-wizard" element={<OnboardingWizard />} />
      </Routes>
    );
  }

  // Standalone full-page views — no MiniLayout
  if (matchSection(pathname, standalonePaths)) {
    return (
      <Routes>
        <Route path="mitre" element={<MitreMatrix />} />
        <Route path="threat-intel" element={<ThreatIntel />} />
        <Route path="pentests" element={<Pentests />} />
        <Route path="pentests/:id" element={<PentestDetail />} />
      </Routes>
    );
  }

  // Monitor section
  if (isMonitor) {
    return (
      <MiniLayout title="Monitor" tabs={monitorTabs}>
        <Routes>
          <Route path="threats" element={<Threats />} />
          <Route path="incidents" element={<Incidents />} />
          <Route path="incidents/:id" element={<IncidentDetail />} />
          <Route path="alerts" element={<AlertConfig />} />
        </Routes>
      </MiniLayout>
    );
  }

  // Security section
  if (isSecurity) {
    return (
      <MiniLayout title="Seguridad" tabs={securityTabs}>
        <Routes>
          <Route path="assets" element={<Assets />} />
          <Route path="vulnerabilities" element={<Vulnerabilities />} />
          <Route path="vulnerabilities/:id" element={<VulnerabilityDetail />} />
          <Route path="audits" element={<Audits />} />
          <Route path="audits/:id" element={<AuditDetail />} />
          <Route path="infrastructure" element={<Infrastructure />} />
          <Route path="certifications" element={<Certifications />} />
        </Routes>
      </MiniLayout>
    );
  }

  // AI & Detection section
  if (isAI) {
    return (
      <MiniLayout title="AI & Detección" tabs={aiTabs}>
        <Routes>
          <Route path="ai-decisions" element={<AiDecisions />} />
          <Route path="ai-evolution" element={<AiEvolution />} />
          <Route path="sensors" element={<Sensors />} />
          <Route path="logs" element={<LogExplorer />} />
          <Route path="hunting" element={<ThreatHunting />} />
          <Route path="sigma" element={<SigmaRules />} />
          <Route path="ueba" element={<Ueba />} />
          <Route path="cep" element={<CepRules />} />
        </Routes>
      </MiniLayout>
    );
  }

  // Response section
  if (isResponse) {
    return (
      <MiniLayout title="Respuesta" tabs={responseTabs}>
        <Routes>
          <Route path="playbooks" element={<Playbooks />} />
          <Route path="playbooks/:id/builder" element={<PlaybookBuilder />} />
          <Route path="forensics" element={<Forensics />} />
          <Route path="deception" element={<Deception />} />
        </Routes>
      </MiniLayout>
    );
  }

  // Network & Cloud section
  if (isNetwork) {
    return (
      <MiniLayout title="Red & Cloud" tabs={networkTabs}>
        <Routes>
          <Route path="compliance" element={<ComplianceDashboard />} />
          <Route path="attack-surface" element={<AttackSurface />} />
          <Route path="cloud-security" element={<CloudSecurity />} />
          <Route path="identity" element={<IdentityThreats />} />
          <Route path="network" element={<NetworkAnalysis />} />
          <Route path="vuln-scanner" element={<VulnScanner />} />
        </Routes>
      </MiniLayout>
    );
  }

  // Admin section
  if (isAdmin) {
    return (
      <MiniLayout title="Administración" tabs={adminTabs}>
        <Routes>
          <Route path="users" element={<Users />} />
          <Route path="roles" element={<RoleManagement />} />
          <Route path="integrations" element={<Integrations />} />
          <Route path="billing" element={<Billing />} />
          <Route path="settings" element={<Settings />} />
        </Routes>
      </MiniLayout>
    );
  }

  // Fallback
  return <Navigate to="/" replace />;
};

// ── App ──
const App: React.FC = () => {
  return (
    <>
    <NotificationToast />
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/landing" element={<Landing />} />
      <Route path="/pricing" element={<Pricing />} />
      <Route path="/onboarding" element={<OnboardingWizard />} />

      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route path="*" element={<SOCRouter />} />
        <Route index element={<SOCRouter />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </>
  );
};

export default App;
