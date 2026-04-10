import React, { useState, useRef, useEffect } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard, ShieldAlert, Radio, LogOut, Settings, Menu, X,
  AlertCircle, Bell, Brain, Server, Search, ScrollText,
  Bug, Award, Shield, Globe, Fingerprint, Network, Glasses, Scan, Cloud,
  ClipboardCheck, Crosshair, Grid3X3, Zap, HardDrive,
  Users, Plug,
  ChevronDown, Building2, FileText, Bot,
} from 'lucide-react';
import AiChatWidget from './AiChatWidget';

// ── Dropdown Menu Component ──
function NavDropdown({ label, items, isActive }: {
  label: string;
  items: { name: string; path: string; icon: React.ComponentType<{ className?: string }> }[];
  isActive: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  if (items.length === 0) return null;

  // Single item → direct link
  if (items.length === 1) {
    const item = items[0];
    return (
      <Link
        to={item.path}
        className={`topnav-link ${isActive ? 'topnav-link--active' : ''}`}
      >
        {label}
      </Link>
    );
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className={`topnav-link ${isActive ? 'topnav-link--active' : ''}`}
      >
        {label}
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="topnav-dropdown">
          {items.map(item => (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => setOpen(false)}
              className="topnav-dropdown__item"
            >
              <item.icon className="w-4 h-4 opacity-40" />
              {item.name}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

const Layout: React.FC = () => {
  const { user, logout, hasPermission } = useAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isSuperAdmin = user?.role === 'superadmin';

  const isActive = (paths: string[]) =>
    paths.some(p => p === '/' ? location.pathname === '/' : location.pathname.startsWith(p));

  const filterPerm = (items: { name: string; path: string; icon: any; permission?: string }[]) =>
    items.filter(i => !i.permission || hasPermission(i.permission));

  // ── Navigation Groups (essential PYME security only) ──
  const monitorItems = filterPerm([
    { name: 'Home', path: '/', icon: LayoutDashboard, permission: 'dashboard:read' },
    { name: 'Amenazas', path: '/threats', icon: ShieldAlert, permission: 'threats:read' },
    { name: 'Incidentes', path: '/incidents', icon: AlertCircle, permission: 'incidents:read' },
    { name: 'Alertas', path: '/alerts', icon: Bell, permission: 'alerts:read' },
  ]);

  const securityItems = filterPerm([
    { name: 'Assets', path: '/assets', icon: Server, permission: 'assets:read' },
    { name: 'Vulnerabilidades', path: '/vulnerabilities', icon: Bug, permission: 'vulnerabilities:read' },
    { name: 'Auditorias', path: '/audits', icon: ClipboardCheck, permission: 'audits:read' },
    { name: 'Infraestructura', path: '/infrastructure', icon: HardDrive, permission: 'dashboard:read' },
  ]);

  const aiItems = filterPerm([
    { name: 'AI Agent', path: '/ai-decisions', icon: Brain, permission: 'ai_agent:read' },
    { name: 'Sensores', path: '/sensors', icon: Radio, permission: 'sensors:read' },
    { name: 'Logs', path: '/logs', icon: ScrollText, permission: 'threats:read' },
  ]);

  const adminItems = filterPerm([
    { name: 'Usuarios', path: '/users', icon: Users, permission: 'users:read' },
    { name: 'Integraciones', path: '/integrations', icon: Plug, permission: 'integrations:read' },
    { name: 'Settings', path: '/settings', icon: Settings },
  ]);

  const superAdminItems = [
    { name: 'Overview', path: '/', icon: LayoutDashboard },
    { name: 'Companies', path: '/superadmin/companies', icon: Building2 },
    { name: 'Onboarding', path: '/superadmin/onboarding', icon: FileText },
    { name: 'Bot', path: '/superadmin/bot', icon: Bot },
  ];

  const navGroups = isSuperAdmin
    ? [{ label: 'Admin', items: superAdminItems, paths: ['/', '/superadmin'] }]
    : [
        { label: 'Monitor', items: monitorItems, paths: ['/', '/threats', '/incidents', '/alerts'] },
        { label: 'Seguridad', items: securityItems, paths: ['/assets', '/vulnerabilities', '/audits', '/infrastructure'] },
        { label: 'IA', items: aiItems, paths: ['/ai-decisions', '/sensors', '/logs'] },
        { label: 'Admin', items: adminItems, paths: ['/users', '/integrations', '/settings'] },
      ];

  return (
    <div className="min-h-screen bg-black text-slate-100" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* ── Top Navigation ── */}
      <nav className="topnav">
        <div className="topnav__left">
          <Link to="/" className="topnav__brand">
            <div className="topnav__logo">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div>
              <div className="topnav__title">BLACKWOLF</div>
              <div className="topnav__subtitle">SOC</div>
            </div>
          </Link>

          {/* Desktop Nav */}
          <div className="topnav__nav">
            {navGroups.map(g => (
              <NavDropdown
                key={g.label}
                label={g.label}
                items={g.items}
                isActive={isActive(g.paths)}
              />
            ))}
          </div>
        </div>

        <div className="topnav__right">
          <div className="topnav__user-info">
            <span className="topnav__user-name">{user?.fullName}</span>
            <span className="topnav__user-role">{user?.role}</span>
          </div>
          <div className="topnav__avatar">
            {user?.fullName?.charAt(0) || 'U'}
          </div>
          <button onClick={logout} className="topnav__logout" title="Logout">
            <LogOut className="w-4 h-4" />
          </button>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="topnav__hamburger"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </nav>

      {/* ── Mobile Menu ── */}
      {mobileOpen && (
        <div className="mobile-menu">
          {navGroups.map(g => (
            <div key={g.label} className="mobile-menu__group">
              <div className="mobile-menu__label">{g.label}</div>
              {g.items.map(item => (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileOpen(false)}
                  className={`mobile-menu__link ${isActive([item.path]) ? 'mobile-menu__link--active' : ''}`}
                >
                  <item.icon className="w-4 h-4 opacity-40" />
                  {item.name}
                </Link>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* ── Page Content ── */}
      <main className="soc-main">
        <Outlet />
      </main>

      {/* AI Chat Widget */}
      {!isSuperAdmin && <AiChatWidget />}
    </div>
  );
};

export default Layout;
