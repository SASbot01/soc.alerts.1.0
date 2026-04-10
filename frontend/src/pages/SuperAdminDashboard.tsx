import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { superAdminService } from '../lib/services';
import {
    Building2, ShieldAlert, Radio, Globe, Activity, ChevronRight,
    Shield, ArrowUpRight, Server, AlertCircle, Bug, HardDrive,
    Bell, Brain, ClipboardCheck, Plus,
} from 'lucide-react';

interface CompanySummary {
    id: string;
    companyName: string;
    domain: string;
    plan: string;
    status: string;
    threatCount: number;
    sensorCount: number;
}

interface GlobalDashboard {
    totalCompanies: number;
    totalThreats: number;
    threatsToday: number;
    totalSensors: number;
    activeSensors: number;
    totalBlockedIPs: number;
    companies: CompanySummary[];
    globalAttackDistribution: Record<string, number>;
}

// ── BlackWolf section shortcuts ──
const BW_SECTIONS = [
    { name: 'Amenazas', icon: ShieldAlert, color: '#EF4444' },
    { name: 'Incidentes', icon: AlertCircle, color: '#F59E0B' },
    { name: 'Assets', icon: Server, color: '#3B82F6' },
    { name: 'Infra', icon: HardDrive, color: '#22C55E' },
    { name: 'Vulns', icon: Bug, color: '#A855F7' },
    { name: 'Auditorias', icon: ClipboardCheck, color: '#F5F5F5' },
    { name: 'Alertas', icon: Bell, color: '#06B6D4' },
    { name: 'AI Agent', icon: Brain, color: '#EC4899' },
];

function useClock() {
    const [now, setNow] = useState(new Date());
    useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);
    return now;
}

const SuperAdminDashboard: React.FC = () => {
    const [data, setData] = useState<GlobalDashboard | null>(null);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();
    const now = useClock();

    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await superAdminService.getDashboard();
                setData(res);
            } catch (error) {
                console.error('Failed to load global dashboard', error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
        const interval = setInterval(fetchData, 30000);
        return () => clearInterval(interval);
    }, []);

    const h = now.getHours();
    const greeting = h < 7 ? 'Buenas noches' : h < 13 ? 'Buenos dias' : h < 20 ? 'Buenas tardes' : 'Buenas noches';
    const timeStr = now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    const dateStr = now.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });

    if (loading) return <div style={{ padding: 40, color: 'rgba(255,255,255,0.4)' }}>Cargando...</div>;
    if (!data) return <div style={{ padding: 40, color: '#EF4444' }}>Error cargando datos.</div>;

    const bwCompany = data.companies.find(c => c.domain === 'blackwolfsec.io' || c.companyName.toLowerCase().includes('blackwolf'));
    const clients = data.companies.filter(c => c.id !== bwCompany?.id && c.companyName !== 'BlackWolf Templates');

    const getPlanColor = (plan: string) => {
        const m: Record<string, string> = { starter: '#22C55E', professional: '#3B82F6', enterprise: '#A855F7' };
        return m[plan] || '#666';
    };

    return (
        <div className="soc-home">
            {/* ── Header with clock ── */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32 }}>
                <div>
                    <div style={{ fontSize: '2.4rem', fontWeight: 200, color: '#E4E4E7', letterSpacing: '-0.03em', lineHeight: 1 }}>
                        {timeStr}
                    </div>
                    <div style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.35)', marginTop: 6, textTransform: 'capitalize' }}>
                        {greeting} — {dateStr}
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 100, background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.15)', fontSize: '0.72rem', color: '#22C55E' }}>
                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#22C55E', boxShadow: '0 0 6px #22C55E' }} />
                        SOC Activo
                    </div>
                </div>
            </div>

            {/* ── Global Quick Stats ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 32 }}>
                {[
                    { label: 'Empresas', value: data.totalCompanies, icon: Building2, color: '#A855F7' },
                    { label: 'Amenazas', value: data.totalThreats, icon: ShieldAlert, color: '#EF4444' },
                    { label: 'Hoy', value: data.threatsToday, icon: Activity, color: '#F59E0B' },
                    { label: 'Sensores', value: `${data.activeSensors}/${data.totalSensors}`, icon: Radio, color: '#22C55E' },
                    { label: 'IPs bloqueadas', value: data.totalBlockedIPs, icon: Globe, color: '#3B82F6' },
                ].map((s, i) => (
                    <div key={i} className="soc-stat">
                        <div className="soc-stat__icon" style={{ background: `${s.color}12`, color: s.color }}>
                            <s.icon style={{ width: 20, height: 20 }} />
                        </div>
                        <div className="soc-stat__value">{s.value}</div>
                        <div className="soc-stat__label">{s.label}</div>
                    </div>
                ))}
            </div>

            {/* ══════════════════════════════════════════════
                BLACKWOLF — Main Company (big card)
               ══════════════════════════════════════════════ */}
            {bwCompany && (
                <div
                    onClick={() => navigate(`/superadmin/company/${bwCompany.id}`)}
                    style={{
                        background: 'rgba(255,255,255,0.04)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: 24,
                        padding: 28,
                        marginBottom: 32,
                        cursor: 'pointer',
                        transition: 'all 0.25s cubic-bezier(0.16,1,0.3,1)',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.2)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.1)'; (e.currentTarget as HTMLElement).style.transform = 'none'; }}
                >
                    {/* Header */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                            <div style={{
                                width: 56, height: 56, borderRadius: 16,
                                background: '#F5F5F5',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                                <Shield style={{ width: 28, height: 28, color: '#000' }} />
                            </div>
                            <div>
                                <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#E4E4E7', letterSpacing: '-0.01em' }}>
                                    BlackWolf Security
                                </div>
                                <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.35)', fontFamily: "'JetBrains Mono', monospace" }}>
                                    {bwCompany.domain}
                                </div>
                            </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                            <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#EF4444' }}>{bwCompany.threatCount}</div>
                                <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>amenazas</div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#22C55E' }}>{bwCompany.sensorCount}</div>
                                <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>sensores</div>
                            </div>
                            <ChevronRight style={{ width: 20, height: 20, color: 'rgba(255,255,255,0.2)' }} />
                        </div>
                    </div>

                    {/* Section shortcuts */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {BW_SECTIONS.map(s => (
                            <div
                                key={s.name}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: 6,
                                    padding: '6px 12px', borderRadius: 100,
                                    background: `${s.color}08`, border: `1px solid ${s.color}15`,
                                    fontSize: '0.72rem', color: `${s.color}`, fontWeight: 500,
                                }}
                            >
                                <s.icon style={{ width: 13, height: 13 }} />
                                {s.name}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ══════════════════════════════════════════════
                CLIENTES
               ══════════════════════════════════════════════ */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
                    Clientes ({clients.length})
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button
                        onClick={() => navigate('/superadmin/onboarding')}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 5,
                            padding: '7px 14px', borderRadius: 100, fontSize: '0.72rem', fontWeight: 600,
                            color: 'rgba(255,255,255,0.5)', background: 'rgba(255,255,255,0.04)',
                            border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer',
                            transition: 'all 0.2s',
                        }}
                    >
                        <Plus style={{ width: 13, height: 13 }} /> Onboarding
                    </button>
                    <button
                        onClick={() => navigate('/superadmin/companies')}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 4,
                            padding: '7px 14px', borderRadius: 100, fontSize: '0.72rem', fontWeight: 500,
                            color: 'rgba(255,255,255,0.4)', background: 'none',
                            border: 'none', cursor: 'pointer',
                        }}
                    >
                        Ver todos <ArrowUpRight style={{ width: 12, height: 12 }} />
                    </button>
                </div>
            </div>

            <div className="soc-companies-grid">
                {clients.map(company => (
                    <button
                        key={company.id}
                        onClick={() => navigate(`/superadmin/company/${company.id}`)}
                        className="soc-company-card"
                    >
                        <div className="soc-company-card__icon">
                            <Building2 style={{ width: 20, height: 20, color: 'rgba(255,255,255,0.4)' }} />
                        </div>
                        <div className="soc-company-card__info">
                            <div className="soc-company-card__name">{company.companyName}</div>
                            <div className="soc-company-card__domain">{company.domain}</div>
                        </div>
                        <div className="soc-company-card__stats">
                            <span style={{ color: '#EF4444', fontSize: '0.82rem', fontWeight: 600 }}>{company.threatCount}</span>
                            <span style={{ color: 'rgba(255,255,255,0.12)' }}>|</span>
                            <span style={{ color: '#22C55E', fontSize: '0.82rem', fontWeight: 600 }}>{company.sensorCount}</span>
                        </div>
                        <div className="soc-company-card__badge" style={{ background: `${getPlanColor(company.plan)}12`, color: getPlanColor(company.plan), border: `1px solid ${getPlanColor(company.plan)}20` }}>
                            {company.plan || 'starter'}
                        </div>
                        <ChevronRight style={{ width: 16, height: 16, color: 'rgba(255,255,255,0.15)' }} />
                    </button>
                ))}

                {clients.length === 0 && (
                    <div style={{
                        gridColumn: '1 / -1', textAlign: 'center', padding: '48px 24px',
                        color: 'rgba(255,255,255,0.2)', fontSize: '0.85rem',
                        background: 'rgba(255,255,255,0.01)', borderRadius: 20,
                        border: '1px dashed rgba(255,255,255,0.06)',
                    }}>
                        <Building2 style={{ width: 32, height: 32, margin: '0 auto 12px', opacity: 0.3 }} />
                        Sin clientes integrados. Usa el onboarding para agregar empresas.
                    </div>
                )}
            </div>
        </div>
    );
};

export default SuperAdminDashboard;
