import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Landing from './pages/Landing';
import Dashboard from './pages/Dashboard';
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
import Marketplace from './pages/Marketplace';
import Layout from './components/Layout';
import NotificationToast from './components/NotificationToast';
import { useAuth } from './context/AuthContext';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <div className="h-screen flex items-center justify-center bg-slate-950 text-white">Loading...</div>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

const DashboardRouter: React.FC = () => {
  const { user } = useAuth();
  if (user?.role === 'superadmin') return <SuperAdminDashboard />;
  return <Dashboard />;
};

const App: React.FC = () => {
  return (
    <>
    <NotificationToast />
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/landing" element={<Landing />} />
      <Route path="/pricing" element={<Pricing />} />

      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<DashboardRouter />} />
        <Route path="threats" element={<Threats />} />
        <Route path="sensors" element={<Sensors />} />
        <Route path="incidents" element={<Incidents />} />
        <Route path="incidents/:id" element={<IncidentDetail />} />
        <Route path="alerts" element={<AlertConfig />} />
        <Route path="ai-decisions" element={<AiDecisions />} />
        <Route path="audits" element={<Audits />} />
        <Route path="audits/:id" element={<AuditDetail />} />
        <Route path="pentests" element={<Pentests />} />
        <Route path="pentests/:id" element={<PentestDetail />} />
        <Route path="vulnerabilities" element={<Vulnerabilities />} />
        <Route path="vulnerabilities/:id" element={<VulnerabilityDetail />} />
        <Route path="certifications" element={<Certifications />} />
        <Route path="playbooks" element={<Playbooks />} />
        <Route path="playbooks/:id/builder" element={<PlaybookBuilder />} />
        <Route path="assets" element={<Assets />} />
        <Route path="mitre" element={<MitreMatrix />} />
        <Route path="hunting" element={<ThreatHunting />} />
        <Route path="sigma" element={<SigmaRules />} />
        <Route path="ueba" element={<Ueba />} />
        <Route path="marketplace" element={<Marketplace />} />
        <Route path="integrations" element={<Integrations />} />
        <Route path="billing" element={<Billing />} />
        <Route path="roles" element={<RoleManagement />} />
        <Route path="settings" element={<Settings />} />
        <Route path="users" element={<Users />} />
        <Route path="superadmin/companies" element={<Companies />} />
        <Route path="superadmin/company/:id" element={<CompanyDetail />} />
        <Route path="superadmin/onboarding" element={<OnboardingRequests />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </>
  );
};

export default App;
