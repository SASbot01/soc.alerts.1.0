import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShieldAlert, AlertCircle, Server, HardDrive, Bug, ClipboardCheck,
  Bell, Brain, Radio, ScrollText, Workflow, Crosshair, Grid3X3,
  Shield, Plug, Settings, Search, TrendingUp, Activity, Wifi, Ban,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';

// ── App definitions ──────────────────────────────────────────────
const SOC_APPS = [
  { id: 'threats', label: 'Amenazas', icon: ShieldAlert, path: '/threats', color: '#EF4444' },
  { id: 'incidents', label: 'Incidentes', icon: AlertCircle, path: '/incidents', color: '#F59E0B' },
  { id: 'assets', label: 'Assets', icon: Server, path: '/assets', color: '#3B82F6' },
  { id: 'infra', label: 'Infra', icon: HardDrive, path: '/infrastructure', color: '#22C55E' },
  { id: 'vulns', label: 'Vulns', icon: Bug, path: '/vulnerabilities', color: '#A855F7' },
  { id: 'audits', label: 'Auditorias', icon: ClipboardCheck, path: '/audits', color: '#F5F5F5' },
  { id: 'alerts', label: 'Alertas', icon: Bell, path: '/alerts', color: '#06B6D4' },
  { id: 'ai', label: 'AI Agent', icon: Brain, path: '/ai-decisions', color: '#EC4899' },
  { id: 'sensors', label: 'Sensores', icon: Radio, path: '/sensors', color: '#10B981' },
  { id: 'logs', label: 'Logs', icon: ScrollText, path: '/logs', color: '#F97316' },
  { id: 'playbooks', label: 'Playbooks', icon: Workflow, path: '/playbooks', color: '#8B5CF6' },
  { id: 'hunting', label: 'Hunting', icon: Crosshair, path: '/hunting', color: '#DC2626' },
  { id: 'mitre', label: 'MITRE', icon: Grid3X3, path: '/mitre', color: '#0EA5E9' },
  { id: 'compliance', label: 'Compliance', icon: Shield, path: '/compliance', color: '#14B8A6' },
  { id: 'integrations', label: 'Integraciones', icon: Plug, path: '/integrations', color: '#78716C' },
  { id: 'settings', label: 'Settings', icon: Settings, path: '/settings', color: '#475569' },
];

// ── Helpers ──────────────────────────────────────────────────────
function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Buenos dias';
  if (h < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

interface OverviewData {
  totalThreats: number;
  activeSensors: number;
  threatsToday: number;
  blockedIps: number;
}

interface RecentThreat {
  id: string;
  name: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  timestamp: string;
  source?: string;
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: '#EF4444',
  high: '#F97316',
  medium: '#F59E0B',
  low: '#3B82F6',
};

// ── Styles ───────────────────────────────────────────────────────
const S = {
  page: {
    minHeight: '100vh',
    background: '#050505',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    color: '#F5F5F5',
    display: 'flex',
    justifyContent: 'center',
    paddingBottom: 48,
  } as React.CSSProperties,

  container: {
    width: '100%',
    maxWidth: 520,
    padding: '0 16px',
  } as React.CSSProperties,

  // Header
  header: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    paddingTop: 40,
    paddingBottom: 8,
    gap: 4,
  } as React.CSSProperties,

  logoRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginBottom: 2,
  } as React.CSSProperties,

  logoIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    background: 'linear-gradient(135deg, #EF4444, #7C3AED)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  } as React.CSSProperties,

  companyName: {
    fontSize: 22,
    fontWeight: 700,
    letterSpacing: '-0.02em',
    color: '#FFFFFF',
    margin: 0,
  } as React.CSSProperties,

  greeting: {
    fontSize: 14,
    color: '#888',
    fontWeight: 400,
    margin: '4px 0 0',
  } as React.CSSProperties,

  userName: {
    color: '#D4D4D4',
    fontWeight: 500,
  } as React.CSSProperties,

  // Quick Stats
  statsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: 10,
    marginTop: 24,
  } as React.CSSProperties,

  statCard: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 14,
    padding: '14px 10px',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: 6,
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
  } as React.CSSProperties,

  statIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  } as React.CSSProperties,

  statValue: {
    fontSize: 20,
    fontWeight: 700,
    lineHeight: 1,
    color: '#FFFFFF',
  } as React.CSSProperties,

  statLabel: {
    fontSize: 10,
    fontWeight: 500,
    color: '#777',
    textAlign: 'center' as const,
    lineHeight: 1.2,
  } as React.CSSProperties,

  // Search
  searchWrap: {
    position: 'relative' as const,
    marginTop: 24,
  } as React.CSSProperties,

  searchIcon: {
    position: 'absolute' as const,
    left: 14,
    top: '50%',
    transform: 'translateY(-50%)',
    color: '#555',
    pointerEvents: 'none' as const,
  } as React.CSSProperties,

  searchInput: {
    width: '100%',
    height: 44,
    borderRadius: 12,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.04)',
    color: '#F5F5F5',
    fontSize: 14,
    fontFamily: "'Inter', sans-serif",
    paddingLeft: 42,
    paddingRight: 14,
    outline: 'none',
    boxSizing: 'border-box' as const,
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
  } as React.CSSProperties,

  // App grid
  gridSection: {
    marginTop: 24,
  } as React.CSSProperties,

  sectionTitle: {
    fontSize: 11,
    fontWeight: 600,
    color: '#666',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.06em',
    marginBottom: 14,
  } as React.CSSProperties,

  appGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: 18,
  } as React.CSSProperties,

  appItem: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: 8,
    cursor: 'pointer',
    transition: 'transform 0.15s ease, opacity 0.15s ease',
  } as React.CSSProperties,

  appIconBox: {
    width: 54,
    height: 54,
    borderRadius: 14,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'transform 0.15s ease, box-shadow 0.15s ease',
  } as React.CSSProperties,

  appLabel: {
    fontSize: 11,
    fontWeight: 500,
    color: '#AAA',
    textAlign: 'center' as const,
    lineHeight: 1.2,
    maxWidth: 70,
    overflow: 'hidden' as const,
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  } as React.CSSProperties,

  // Recent threats
  threatsSection: {
    marginTop: 32,
  } as React.CSSProperties,

  threatCard: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '12px 14px',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.05)',
    borderRadius: 12,
    marginBottom: 8,
    cursor: 'pointer',
    transition: 'background 0.15s ease',
  } as React.CSSProperties,

  threatDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    flexShrink: 0,
  } as React.CSSProperties,

  threatInfo: {
    flex: 1,
    minWidth: 0,
  } as React.CSSProperties,

  threatName: {
    fontSize: 13,
    fontWeight: 600,
    color: '#E5E5E5',
    whiteSpace: 'nowrap' as const,
    overflow: 'hidden' as const,
    textOverflow: 'ellipsis',
  } as React.CSSProperties,

  threatMeta: {
    fontSize: 11,
    color: '#666',
    marginTop: 2,
  } as React.CSSProperties,

  threatBadge: {
    fontSize: 10,
    fontWeight: 700,
    padding: '2px 8px',
    borderRadius: 6,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.04em',
    flexShrink: 0,
  } as React.CSSProperties,

  // Shimmer placeholder
  shimmer: {
    background: 'linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 75%)',
    backgroundSize: '200% 100%',
    animation: 'soc-shimmer 1.5s infinite',
    borderRadius: 8,
  } as React.CSSProperties,

  emptyText: {
    fontSize: 13,
    color: '#555',
    textAlign: 'center' as const,
    padding: '20px 0',
  } as React.CSSProperties,
};

// ── Component ────────────────────────────────────────────────────
export default function SOCHome() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [threats, setThreats] = useState<RecentThreat[]>([]);
  const [loading, setLoading] = useState(true);
  const [hoveredApp, setHoveredApp] = useState<string | null>(null);

  // Fetch dashboard data
  useEffect(() => {
    let cancelled = false;
    const fetchData = async () => {
      try {
        const res = await api.get('/dashboard/overview');
        if (!cancelled && res.data) {
          const d = res.data;
          setOverview({
            totalThreats: d.totalThreats ?? 0,
            activeSensors: d.activeSensors ?? 0,
            threatsToday: d.threatsToday ?? 0,
            blockedIps: d.blockedIps ?? 0,
          });
          if (Array.isArray(d.recentThreats)) {
            setThreats(d.recentThreats.slice(0, 5));
          }
        }
      } catch {
        // silently fail — stats show 0
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchData();
    const interval = setInterval(fetchData, 30_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  // Filtered apps
  const filteredApps = useMemo(() => {
    if (!search.trim()) return SOC_APPS;
    const q = search.toLowerCase();
    return SOC_APPS.filter(a =>
      a.label.toLowerCase().includes(q) || a.id.toLowerCase().includes(q)
    );
  }, [search]);

  // Stats config
  const stats = [
    { label: 'Amenazas', value: overview?.totalThreats ?? 0, icon: TrendingUp, bg: 'rgba(239,68,68,0.15)', iconColor: '#EF4444' },
    { label: 'Sensores activos', value: overview?.activeSensors ?? 0, icon: Activity, bg: 'rgba(34,197,94,0.15)', iconColor: '#22C55E' },
    { label: 'Amenazas hoy', value: overview?.threatsToday ?? 0, icon: Wifi, bg: 'rgba(245,158,11,0.15)', iconColor: '#F59E0B' },
    { label: 'IPs bloqueadas', value: overview?.blockedIps ?? 0, icon: Ban, bg: 'rgba(168,85,247,0.15)', iconColor: '#A855F7' },
  ];

  const firstName = user?.fullName?.split(' ')[0] || 'Operador';

  return (
    <>
      {/* Keyframes injected once */}
      <style>{`
        @keyframes soc-shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        @keyframes soc-fadein {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div style={S.page}>
        <div style={S.container}>

          {/* ── Header ────────────────────────────── */}
          <header style={{ ...S.header, animation: 'soc-fadein 0.4s ease both' }}>
            <div style={S.logoRow}>
              <div style={S.logoIcon}>
                <ShieldAlert size={20} color="#FFF" />
              </div>
              <h1 style={S.companyName}>BlackWolf SOC</h1>
            </div>
            <p style={S.greeting}>
              {getGreeting()}, <span style={S.userName}>{firstName}</span>
            </p>
          </header>

          {/* ── Quick Stats ───────────────────────── */}
          <div style={{ ...S.statsRow, animation: 'soc-fadein 0.4s ease 0.08s both' }}>
            {stats.map((s, i) => {
              const Icon = s.icon;
              return (
                <div key={i} style={S.statCard}>
                  <div style={{ ...S.statIcon, background: s.bg }}>
                    <Icon size={15} color={s.iconColor} />
                  </div>
                  {loading ? (
                    <div style={{ ...S.shimmer, width: 32, height: 20 }} />
                  ) : (
                    <span style={S.statValue}>{s.value.toLocaleString()}</span>
                  )}
                  <span style={S.statLabel}>{s.label}</span>
                </div>
              );
            })}
          </div>

          {/* ── Search ────────────────────────────── */}
          <div style={{ ...S.searchWrap, animation: 'soc-fadein 0.4s ease 0.14s both' }}>
            <div style={S.searchIcon}>
              <Search size={16} />
            </div>
            <input
              style={S.searchInput}
              placeholder="Buscar modulo..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {/* ── App Grid ──────────────────────────── */}
          <section style={{ ...S.gridSection, animation: 'soc-fadein 0.4s ease 0.2s both' }}>
            <p style={S.sectionTitle}>Modulos</p>
            <div style={S.appGrid}>
              {filteredApps.map(app => {
                const Icon = app.icon;
                const isHovered = hoveredApp === app.id;
                return (
                  <div
                    key={app.id}
                    style={{
                      ...S.appItem,
                      transform: isHovered ? 'scale(1.08)' : 'scale(1)',
                      opacity: isHovered ? 1 : 0.92,
                    }}
                    onClick={() => navigate(app.path)}
                    onMouseEnter={() => setHoveredApp(app.id)}
                    onMouseLeave={() => setHoveredApp(null)}
                  >
                    <div
                      style={{
                        ...S.appIconBox,
                        background: app.color,
                        boxShadow: isHovered
                          ? `0 4px 20px ${app.color}44`
                          : `0 2px 8px ${app.color}22`,
                      }}
                    >
                      <Icon size={24} color={app.id === 'audits' ? '#1A1A1A' : '#FFFFFF'} />
                    </div>
                    <span style={S.appLabel}>{app.label}</span>
                  </div>
                );
              })}
              {filteredApps.length === 0 && (
                <div style={{ ...S.emptyText, gridColumn: '1 / -1' }}>
                  Sin resultados para "{search}"
                </div>
              )}
            </div>
          </section>

          {/* ── Recent Threats ─────────────────────── */}
          <section style={{ ...S.threatsSection, animation: 'soc-fadein 0.4s ease 0.28s both' }}>
            <p style={S.sectionTitle}>Amenazas recientes</p>
            {loading ? (
              [0, 1, 2].map(i => (
                <div key={i} style={{ ...S.shimmer, height: 52, marginBottom: 8, borderRadius: 12 }} />
              ))
            ) : threats.length === 0 ? (
              <p style={S.emptyText}>No hay amenazas recientes</p>
            ) : (
              threats.map(t => {
                const sevColor = SEVERITY_COLORS[t.severity] || '#6B7280';
                const timeAgo = formatTimeAgo(t.timestamp);
                return (
                  <div
                    key={t.id}
                    style={S.threatCard}
                    onClick={() => navigate(`/threats/${t.id}`)}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.06)';
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.03)';
                    }}
                  >
                    <div style={{ ...S.threatDot, background: sevColor }} />
                    <div style={S.threatInfo}>
                      <div style={S.threatName}>{t.name}</div>
                      <div style={S.threatMeta}>
                        {t.source ? `${t.source} · ` : ''}{timeAgo}
                      </div>
                    </div>
                    <span
                      style={{
                        ...S.threatBadge,
                        background: `${sevColor}22`,
                        color: sevColor,
                      }}
                    >
                      {t.severity}
                    </span>
                  </div>
                );
              })
            )}
          </section>

        </div>
      </div>
    </>
  );
}

// ── Time formatting helper ───────────────────────────────────────
function formatTimeAgo(timestamp: string): string {
  const now = Date.now();
  const then = new Date(timestamp).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return 'Ahora';
  if (diffMin < 60) return `Hace ${diffMin}m`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `Hace ${diffH}h`;
  const diffD = Math.floor(diffH / 24);
  return `Hace ${diffD}d`;
}
