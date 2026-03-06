import React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
    LayoutDashboard, ShieldAlert, Radio, LogOut, Settings, Menu,
    ClipboardCheck, Crosshair, Bug, Award, Users, Building2,
    AlertCircle, Bell, FileText, Zap, Server, Grid3X3, Brain, CreditCard, ShieldCheck, Plug, Search, FileCode,
    Activity, ShoppingBag, Bot, Sparkles, HardDrive
} from 'lucide-react';
import clsx from 'clsx';
import AiChatWidget from './AiChatWidget';

const Layout: React.FC = () => {
    const { user, logout, hasPermission } = useAuth();
    const location = useLocation();
    const [sidebarOpen, setSidebarOpen] = React.useState(true);

    const isSuperAdmin = user?.role === 'superadmin';
    // Superadmin gets a different nav
    const superAdminNavItems = [
        { name: 'Global Overview', path: '/', icon: LayoutDashboard },
        { name: 'Companies', path: '/superadmin/companies', icon: Building2 },
        { name: 'Onboarding', path: '/superadmin/onboarding', icon: FileText },
        { name: 'Bot Dashboard', path: '/superadmin/bot', icon: Bot },
    ];

    const mainNavItems = [
        { name: 'Overview', path: '/', icon: LayoutDashboard, permission: 'dashboard:read' },
        { name: 'Threats', path: '/threats', icon: ShieldAlert, permission: 'threats:read' },
        { name: 'Incidents', path: '/incidents', icon: AlertCircle, permission: 'incidents:read' },
        { name: 'Playbooks', path: '/playbooks', icon: Zap, permission: 'playbooks:read' },
        { name: 'Assets', path: '/assets', icon: Server, permission: 'assets:read' },
        { name: 'Sensors', path: '/sensors', icon: Radio, permission: 'sensors:read' },
        { name: 'Alerts', path: '/alerts', icon: Bell, permission: 'alerts:read' },
        { name: 'AI Agent', path: '/ai-decisions', icon: Brain, permission: 'ai_agent:read' },
        { name: 'AI Evolution', path: '/ai-evolution', icon: Sparkles, permission: 'ai_agent:read' },
        { name: 'Threat Hunting', path: '/hunting', icon: Search, permission: 'threats:read' },
        { name: 'SIGMA Rules', path: '/sigma', icon: FileCode, permission: 'threats:read' },
        { name: 'UEBA', path: '/ueba', icon: Activity, permission: 'threats:read' },
        { name: 'Infrastructure', path: '/infrastructure', icon: HardDrive, permission: 'dashboard:read' },
    ];

    const socNavItems = [
        { name: 'MITRE ATT&CK', path: '/mitre', icon: Grid3X3, permission: 'mitre:read' },
        { name: 'Audits', path: '/audits', icon: ClipboardCheck, permission: 'audits:read' },
        { name: 'Pentests', path: '/pentests', icon: Crosshair, permission: 'pentests:read' },
        { name: 'Vulnerabilities', path: '/vulnerabilities', icon: Bug, permission: 'vulnerabilities:read' },
        { name: 'Certifications', path: '/certifications', icon: Award, permission: 'certifications:read' },
    ];

    const adminNavItems = [
        { name: 'Users', path: '/users', icon: Users, permission: 'users:read' },
        { name: 'Roles', path: '/roles', icon: ShieldCheck, permission: 'roles:read' },
        { name: 'Integrations', path: '/integrations', icon: Plug, permission: 'integrations:read' },
        { name: 'Marketplace', path: '/marketplace', icon: ShoppingBag, permission: 'settings:read' },
        { name: 'Billing', path: '/billing', icon: CreditCard, permission: 'billing:read' },
    ];

    const bottomNavItems = [
        { name: 'Settings', path: '/settings', icon: Settings },
    ];

    const isActive = (path: string) => {
        if (path === '/') return location.pathname === '/';
        return location.pathname.startsWith(path);
    };

    const renderNavItem = (item: { name: string; path: string; icon: React.ComponentType<{ className?: string }> }) => (
        <Link
            key={item.path}
            to={item.path}
            className={clsx(
                "flex items-center gap-3 px-4 py-3 rounded-[2px] transition-all duration-200 group",
                isActive(item.path)
                    ? "bg-primary-500/10 text-primary-400 border border-primary-500/20"
                    : "text-slate-400 hover:bg-slate-800 hover:text-slate-100"
            )}
        >
            <item.icon className="w-5 h-5 flex-shrink-0" />
            <span className={clsx("font-medium", !sidebarOpen && "lg:hidden")}>{item.name}</span>
        </Link>
    );

    const filterByPermission = (items: Array<{ name: string; path: string; icon: React.ComponentType<{ className?: string }>; permission?: string }>) => {
        return items.filter(item => !item.permission || hasPermission(item.permission));
    };

    const filteredMainNav = filterByPermission(mainNavItems);
    const filteredSocNav = filterByPermission(socNavItems);
    const filteredAdminNav = filterByPermission(adminNavItems);

    return (
        <div className="flex h-screen bg-slate-900 text-slate-100 font-sans">
            {/* Sidebar */}
            <aside
                className={clsx(
                    "fixed inset-y-0 left-0 z-50 w-64 bg-slate-950 border-r border-slate-800 transition-transform duration-300 transform lg:relative lg:translate-x-0",
                    !sidebarOpen && "-translate-x-full lg:w-20"
                )}
            >
                <div className="flex items-center justify-between p-4 border-b border-slate-800">
                    <div className={clsx("flex items-center gap-2", !sidebarOpen && "lg:hidden")}>
                        <ShieldAlert className="w-8 h-8 text-white" />
                        <span className="text-xl font-bold font-display tracking-[0.1em] headline-metallic">
                            BLACKWOLF
                        </span>
                    </div>
                </div>

                <div className="flex flex-col h-[calc(100%-65px)] overflow-y-auto">
                    <nav className="p-4 space-y-2 flex-1">
                        {isSuperAdmin ? (
                            <>
                                {superAdminNavItems.map(renderNavItem)}
                            </>
                        ) : (
                            <>
                                {/* Main Navigation */}
                                {filteredMainNav.map(renderNavItem)}

                                {/* SOC Operations Section */}
                                {filteredSocNav.length > 0 && (
                                    <>
                                        <div className="pt-4 pb-2">
                                            <span className={clsx("px-4 text-[10px] font-bold uppercase tracking-widest text-slate-600", !sidebarOpen && "lg:hidden")}>
                                                SOC Operations
                                            </span>
                                        </div>
                                        {filteredSocNav.map(renderNavItem)}
                                    </>
                                )}

                                {/* Admin Section */}
                                {filteredAdminNav.length > 0 && (
                                    <>
                                        <div className="pt-4 pb-2">
                                            <span className={clsx("px-4 text-[10px] font-bold uppercase tracking-widest text-slate-600", !sidebarOpen && "lg:hidden")}>
                                                Administration
                                            </span>
                                        </div>
                                        {filteredAdminNav.map(renderNavItem)}
                                    </>
                                )}
                            </>
                        )}

                        {/* Settings */}
                        <div className="pt-4">
                            {bottomNavItems.map(renderNavItem)}
                        </div>
                    </nav>

                    <div className="p-4 border-t border-slate-800">
                        <button
                            onClick={logout}
                            className="flex items-center gap-3 w-full px-4 py-3 text-slate-400 hover:bg-red-500/10 hover:text-red-400 rounded-[2px] transition-all"
                        >
                            <LogOut className="w-5 h-5" />
                            <span className={clsx(!sidebarOpen && "lg:hidden")}>Logout</span>
                        </button>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
                {/* Header */}
                <header className="h-16 bg-slate-900/50 backdrop-blur-md border-b border-slate-800 flex items-center justify-between px-6 z-40">
                    <button
                        onClick={() => setSidebarOpen(!sidebarOpen)}
                        className="p-2 text-slate-400 hover:text-white rounded-[2px] lg:hidden"
                    >
                        <Menu className="w-6 h-6" />
                    </button>

                    <div className="flex items-center gap-4 ml-auto">
                        <div className="text-right hidden sm:block">
                            <div className="text-sm font-medium text-white">{user?.fullName}</div>
                            <div className="text-xs text-slate-400 uppercase tracking-wider">{user?.role}</div>
                        </div>
                        <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-black font-bold border-2 border-slate-800 shadow-lg">
                            {user?.fullName?.charAt(0) || 'U'}
                        </div>
                    </div>
                </header>

                {/* Page Content */}
                <div className="flex-1 overflow-auto p-6 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
                    <Outlet />
                </div>
            </main>

            {/* AI Chat Widget - only for non-superadmin users */}
            {!isSuperAdmin && <AiChatWidget />}
        </div>
    );
};

export default Layout;
