import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import {
    ShieldAlert, Radio, Activity, Globe, Server,
    AlertCircle, Bell, Brain, Bug, HardDrive,
    ClipboardCheck, ChevronRight, ArrowUpRight, Download, FileText,
} from 'lucide-react';
import { reportService } from '../lib/services';
import { useSseEvents } from '../hooks/useSseEvents';
import { useAuth } from '../context/AuthContext';

// ── Essential PYME security sections ──
const SECTIONS = [
    {
        key: 'threats',
        title: 'Amenazas',
        description: 'Deteccion y respuesta en tiempo real',
        icon: ShieldAlert,
        color: '#EF4444',
        path: '/threats',
    },
    {
        key: 'incidents',
        title: 'Incidentes',
        description: 'Gestion del ciclo de vida de incidentes',
        icon: AlertCircle,
        color: '#F59E0B',
        path: '/incidents',
    },
    {
        key: 'assets',
        title: 'Assets',
        description: 'Inventario y control de activos',
        icon: Server,
        color: '#3B82F6',
        path: '/assets',
    },
    {
        key: 'infra',
        title: 'Infraestructura',
        description: 'Estado de sensores y servicios',
        icon: HardDrive,
        color: '#22C55E',
        path: '/infrastructure',
    },
    {
        key: 'vulns',
        title: 'Vulnerabilidades',
        description: 'CVEs y parcheado de sistemas',
        icon: Bug,
        color: '#A855F7',
        path: '/vulnerabilities',
    },
    {
        key: 'audits',
        title: 'Auditorias',
        description: 'Auditorias de seguridad y compliance',
        icon: ClipboardCheck,
        color: '#F5F5F5',
        path: '/audits',
    },
    {
        key: 'alerts',
        title: 'Alertas',
        description: 'Configuracion de notificaciones',
        icon: Bell,
        color: '#06B6D4',
        path: '/alerts',
    },
    {
        key: 'ai',
        title: 'AI Agent',
        description: 'Decisiones autonomas del agente IA',
        icon: Brain,
        color: '#EC4899',
        path: '/ai-decisions',
    },
];

const Dashboard: React.FC = () => {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const { user } = useAuth();
    const navigate = useNavigate();

    const fetchData = useCallback(async () => {
        try {
            const res = await api.get('/dashboard/overview');
            setData(res.data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    }, []);

    useSseEvents({
        companyId: user?.companyId || null,
        onThreat: useCallback(() => fetchData(), [fetchData]),
        onIncident: useCallback(() => fetchData(), [fetchData]),
        onDashboardUpdate: useCallback(() => fetchData(), [fetchData]),
    });

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 30000);
        return () => clearInterval(interval);
    }, [fetchData]);

    const greeting = () => {
        const h = new Date().getHours();
        if (h < 12) return 'Buenos dias';
        if (h < 19) return 'Buenas tardes';
        return 'Buenas noches';
    };

    const stats = data ? [
        { label: 'Amenazas totales', value: data.stats?.total_threats || 0, icon: ShieldAlert, color: '#EF4444' },
        { label: 'Sensores activos', value: data.stats?.active_sensors || 0, icon: Radio, color: '#22C55E' },
        { label: 'Amenazas hoy', value: data.stats?.threats_today || 0, icon: Activity, color: '#F59E0B' },
        { label: 'IPs bloqueadas', value: data.stats?.blocked_ips || 0, icon: Globe, color: '#3B82F6' },
    ] : [];

    return (
        <div className="soc-home">
            {/* ── Header ── */}
            <div className="soc-home__header">
                <div>
                    <h1 className="soc-home__greeting">
                        {greeting()}, {user?.fullName?.split(' ')[0]}
                    </h1>
                    <p className="soc-home__subtitle">
                        {data?.company?.name ? `${data.company.name} — ` : ''}Centro de Seguridad
                    </p>
                </div>
                <div className="soc-home__actions">
                    <button onClick={() => reportService.downloadExecutivePDF()} className="soc-home__btn">
                        <FileText style={{ width: 14, height: 14 }} /> PDF
                    </button>
                    <button onClick={() => reportService.downloadThreatsCSV()} className="soc-home__btn">
                        <Download style={{ width: 14, height: 14 }} /> CSV
                    </button>
                </div>
            </div>

            {/* ── Quick Stats ── */}
            <div className="soc-stats-row">
                {loading && !data
                    ? [1, 2, 3, 4].map(i => (
                        <div key={i} className="soc-stat" style={{ opacity: 0.3 }}>
                            <div className="soc-stat__value">—</div>
                            <div className="soc-stat__label">Cargando...</div>
                        </div>
                    ))
                    : stats.map((stat, i) => (
                        <div key={i} className="soc-stat">
                            <div className="soc-stat__icon" style={{ background: `${stat.color}12`, color: stat.color }}>
                                <stat.icon style={{ width: 20, height: 20 }} />
                            </div>
                            <div className="soc-stat__value">{stat.value}</div>
                            <div className="soc-stat__label">{stat.label}</div>
                        </div>
                    ))
                }
            </div>

            {/* ── Recent Threats ── */}
            {data?.recent_threats?.length > 0 && (
                <div className="soc-recent-card">
                    <div className="soc-recent-card__header">
                        <span>Amenazas recientes</span>
                        <button onClick={() => navigate('/threats')} className="soc-recent-card__link">
                            Ver todas <ArrowUpRight style={{ width: 12, height: 12 }} />
                        </button>
                    </div>
                    <div className="soc-recent-card__list">
                        {data.recent_threats.slice(0, 5).map((t: any) => (
                            <div key={t.id} className="soc-recent-card__item">
                                <div className={`soc-recent-card__dot ${t.severity >= 4 ? 'soc-recent-card__dot--critical' : 'soc-recent-card__dot--warning'}`} />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div className="soc-recent-card__threat">{t.threatType}</div>
                                    <div className="soc-recent-card__ip">{t.srcIp} → {t.dstIp}</div>
                                </div>
                                <div className="soc-recent-card__time">
                                    {new Date(t.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ── Section Cards Grid ── */}
            <div className="soc-cards-grid">
                {SECTIONS.map(section => (
                    <button
                        key={section.key}
                        className="soc-nav-card"
                        onClick={() => navigate(section.path)}
                    >
                        <div className="soc-nav-card__icon" style={{ background: `${section.color}10`, color: section.color, border: `1px solid ${section.color}20` }}>
                            <section.icon style={{ width: 22, height: 22 }} />
                        </div>
                        <div className="soc-nav-card__text">
                            <div className="soc-nav-card__title">{section.title}</div>
                            <div className="soc-nav-card__desc">{section.description}</div>
                        </div>
                        <ChevronRight style={{ width: 16, height: 16, color: 'rgba(255,255,255,0.15)' }} className="soc-nav-card__arrow" />
                    </button>
                ))}
            </div>
        </div>
    );
};

export default Dashboard;
