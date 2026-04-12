// Mythonos — pentester con IA, versión simple para humanos.
//
// Diseño guiado por: lenguaje natural, no jerga, formulario en pasos,
// botón grande de acción, drawer con actividad traducida.
//
// API: /mythonos-api/* — sin cambios respecto a la versión técnica.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Sparkles, Globe, Server, Plug, Play, Square, RefreshCw, ChevronRight,
  ShieldCheck, AlertTriangle, CheckCircle2, Clock, Activity,
  Bug, Eye, Search, Swords, X, Settings as SettingsIcon, ChevronDown,
  PlusCircle, ListChecks, Home, Loader2,
} from 'lucide-react';

// ── Tipos ──
type Severity = 'info' | 'low' | 'medium' | 'high' | 'critical';
type Confidence = 'low' | 'medium' | 'high';
type ScanStatus = 'queued' | 'running' | 'completed' | 'failed' | 'stopped';
type Intensity = 'passive' | 'active' | 'aggressive';
type TargetType = 'web' | 'api' | 'network';

interface Target {
  type: TargetType;
  url?: string;
  hosts?: string[];
}

interface Engagement {
  authorized: boolean;
  client?: string;
  intensity: Intensity;
  inScope: string;
  outOfScope: string;
  auth?: {
    loginUrl?: string;
    username?: string;
    password?: string;
    cookie?: string;
    token?: string;
  } | null;
  technologies?: string;
  notes?: string;
}

interface Scan {
  id: string;
  name: string;
  target: Target;
  engagement: Engagement;
  objective: string;
  model: string;
  status: ScanStatus;
  createdAt: string;
  updatedAt: string;
  iterations: number;
  usage: { inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheCreationTokens: number };
  findingsCount: number;
  error: string | null;
  summary?: string;
}

interface Finding {
  id: string;
  scanId: string;
  title: string;
  severity: Severity;
  cwe: string | null;
  location: string | null;
  description: string;
  reproduction: string;
  poc: string;
  confidence: Confidence;
  createdAt: string;
}

interface ModelInfo {
  id: string;
  label: string;
  family: string;
  contextWindow: number;
  maxOutputTokens: number;
  available: boolean;
  description: string;
}

interface AgentEvent {
  ts: string;
  type: string;
  iteration?: number;
  text?: string;
  name?: string;
  input?: unknown;
  preview?: string;
  isError?: boolean;
  error?: string;
  summary?: string;
}

// ── Helpers de presentación ──
const SEV_LABEL: Record<Severity, string> = {
  critical: 'Crítica',
  high: 'Alta',
  medium: 'Media',
  low: 'Baja',
  info: 'Informativa',
};

const SEV_COLOR: Record<Severity, string> = {
  critical: 'bg-red-600 text-white border-red-600',
  high:     'bg-red-500/15 text-red-300 border-red-500/40',
  medium:   'bg-amber-500/15 text-amber-300 border-amber-500/40',
  low:      'bg-blue-500/15 text-blue-300 border-blue-500/40',
  info:     'bg-slate-700/40 text-slate-300 border-slate-600',
};

const STATUS_LABEL: Record<ScanStatus, string> = {
  queued: 'En cola',
  running: 'Trabajando',
  completed: 'Terminado',
  failed: 'Con error',
  stopped: 'Detenido',
};

const STATUS_COLOR: Record<ScanStatus, string> = {
  queued: 'text-amber-300 bg-amber-500/10 border-amber-500/30',
  running: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30',
  completed: 'text-blue-300 bg-blue-500/10 border-blue-500/30',
  failed: 'text-red-300 bg-red-500/10 border-red-500/30',
  stopped: 'text-slate-300 bg-slate-600/10 border-slate-600/40',
};

const StatusIcon: React.FC<{ s: ScanStatus; className?: string }> = ({ s, className = 'w-4 h-4' }) => {
  if (s === 'running') return <Loader2 className={`${className} animate-spin`} />;
  if (s === 'queued') return <Clock className={className} />;
  if (s === 'completed') return <CheckCircle2 className={className} />;
  if (s === 'failed') return <AlertTriangle className={className} />;
  return <Square className={className} />;
};

// "hace 2 minutos" en español
const timeAgo = (iso: string) => {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'hace unos segundos';
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`;
  return `hace ${Math.floor(diff / 86400)} d`;
};

// Traduce un evento técnico del agente a una línea natural en español.
function describeEvent(e: AgentEvent): { icon: string; text: string; tone: string } {
  if (e.type === 'agent_start')
    return { icon: '🚀', text: 'Iniciando análisis...', tone: 'text-purple-300' };
  if (e.type === 'agent_text' && e.text)
    return { icon: '💭', text: e.text.length > 200 ? e.text.slice(0, 200) + '…' : e.text, tone: 'text-slate-400 italic' };
  if (e.type === 'tool_use') {
    const name = e.name || '';
    const cmd = (e.input as { command?: string })?.command || '';
    if (name === 'run_shell') {
      const tool = cmd.split(/\s+/)[0] || 'comando';
      const friendly: Record<string, string> = {
        nmap: 'Escaneando puertos con nmap',
        nikto: 'Buscando vulnerabilidades web con nikto',
        whatweb: 'Identificando tecnologías del sitio',
        sqlmap: 'Probando inyección SQL',
        gobuster: 'Buscando rutas y archivos ocultos',
        ffuf: 'Fuzzing de parámetros',
        nuclei: 'Ejecutando plantillas de vulnerabilidades (nuclei)',
        curl: 'Haciendo petición HTTP',
        dig: 'Consultando DNS',
        host: 'Resolviendo DNS',
        openssl: 'Inspeccionando TLS/SSL',
        hydra: 'Probando credenciales',
      };
      return { icon: '🔧', text: friendly[tool] || `Ejecutando ${tool}`, tone: 'text-purple-300' };
    }
    if (name === 'list_dir') return { icon: '📁', text: 'Explorando directorio', tone: 'text-purple-300' };
    if (name === 'read_file') return { icon: '📄', text: 'Leyendo archivo', tone: 'text-purple-300' };
    if (name === 'write_file') return { icon: '✍️', text: 'Guardando notas', tone: 'text-purple-300' };
    if (name === 'report_finding') {
      const sev = (e.input as { severity?: string })?.severity || '';
      return { icon: '🐛', text: `Reportando vulnerabilidad ${sev}`, tone: 'text-red-300 font-semibold' };
    }
    if (name === 'finish_scan') return { icon: '🏁', text: 'Cerrando análisis', tone: 'text-blue-300' };
    return { icon: '🔧', text: `Acción: ${name}`, tone: 'text-purple-300' };
  }
  if (e.type === 'tool_result') {
    if (e.isError) return { icon: '⚠️', text: 'La acción dio un error, ajustando...', tone: 'text-amber-400' };
    return { icon: '✅', text: 'Resultado obtenido', tone: 'text-emerald-400' };
  }
  if (e.type === 'agent_done')
    return { icon: '🏁', text: 'Análisis finalizado', tone: 'text-blue-300 font-semibold' };
  if (e.type === 'agent_error')
    return { icon: '❌', text: `Error: ${e.error || 'desconocido'}`, tone: 'text-red-400' };
  if (e.type === 'end_turn') return { icon: '⏸️', text: 'Pausa breve', tone: 'text-slate-500' };
  return { icon: '·', text: e.type, tone: 'text-slate-500' };
}

const inputCls = 'w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-white text-base focus:border-purple-500 focus:outline-none placeholder-slate-500';
const cardCls = 'bg-slate-900/60 border border-slate-800 rounded-2xl p-5';
const labelCls = 'block text-sm text-slate-300 mb-2';

const api = (path: string, opts?: RequestInit) =>
  fetch(`/mythonos-api${path}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...opts?.headers },
  });

// ── Componente principal ──
type Tab = 'home' | 'new' | 'scans' | 'findings' | 'settings';

const Mythonos: React.FC = () => {
  const [tab, setTab] = useState<Tab>('home');
  const [scans, setScans] = useState<Scan[]>([]);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [activeModel, setActiveModel] = useState<string>('');
  const [health, setHealth] = useState<{ ok: boolean; hasApiKey: boolean; activeModel: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedScan, setSelectedScan] = useState<Scan | null>(null);
  const [scanEvents, setScanEvents] = useState<AgentEvent[]>([]);
  const [scanFindings, setScanFindings] = useState<Finding[]>([]);
  const [selectedFinding, setSelectedFinding] = useState<Finding | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [scansRes, findingsRes, modelsRes, healthRes] = await Promise.all([
        api('/scans'), api('/findings'), api('/models'), api('/health'),
      ]);
      if (scansRes.ok) setScans(await scansRes.json());
      if (findingsRes.ok) setFindings(await findingsRes.json());
      if (modelsRes.ok) {
        const m = await modelsRes.json();
        setModels(m.models || []);
        setActiveModel(m.active || '');
      }
      if (healthRes.ok) setHealth(await healthRes.json());
    } catch (err) {
      console.error('[mythonos] error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    const id = setInterval(fetchAll, 5000);
    return () => clearInterval(id);
  }, [fetchAll]);

  // Live tail del análisis abierto
  useEffect(() => {
    if (!selectedScan) return;
    let alive = true;
    const tick = async () => {
      const [eRes, fRes, sRes] = await Promise.all([
        api(`/scans/${selectedScan.id}/events?limit=300`),
        api(`/scans/${selectedScan.id}/findings`),
        api(`/scans/${selectedScan.id}`),
      ]);
      if (!alive) return;
      if (eRes.ok) setScanEvents(await eRes.json());
      if (fRes.ok) setScanFindings(await fRes.json());
      if (sRes.ok) setSelectedScan(await sRes.json());
    };
    tick();
    const id = setInterval(tick, 2500);
    return () => { alive = false; clearInterval(id); };
  }, [selectedScan?.id]);

  const stats = useMemo(() => {
    const running = scans.filter(s => s.status === 'running' || s.status === 'queued').length;
    const completed = scans.filter(s => s.status === 'completed').length;
    const bySev = findings.reduce<Record<string, number>>((a, f) => {
      a[f.severity] = (a[f.severity] || 0) + 1;
      return a;
    }, {});
    return {
      running,
      completed,
      total: scans.length,
      totalFindings: findings.length,
      criticalCount: (bySev.critical || 0) + (bySev.high || 0),
      bySev,
    };
  }, [scans, findings]);

  const tabs: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'home',     label: 'Inicio',           icon: Home },
    { id: 'new',      label: 'Nuevo análisis',   icon: PlusCircle },
    { id: 'scans',    label: 'Mis análisis',     icon: ListChecks },
    { id: 'findings', label: 'Vulnerabilidades', icon: Bug },
    { id: 'settings', label: 'Ajustes',          icon: SettingsIcon },
  ];

  return (
    <div className="min-h-[calc(100vh-64px)] bg-black text-slate-100 px-6 py-8">
      {/* ── Cabecera ── */}
      <div className="max-w-6xl mx-auto mb-8">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-600 to-fuchsia-600 flex items-center justify-center shadow-lg shadow-purple-900/30">
              <Sparkles className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Mythonos</h1>
              <p className="text-slate-400 mt-0.5">
                Tu pentester con inteligencia artificial. Analiza webs, APIs y redes mientras tu equipo revisa los resultados.
              </p>
              {health && !health.hasApiKey && (
                <div className="mt-2 text-xs text-red-300 bg-red-950/40 border border-red-900/60 rounded-lg px-3 py-1.5 inline-block">
                  ⚠ Falta configurar la clave del modelo (ANTHROPIC_API_KEY)
                </div>
              )}
            </div>
          </div>
          <button
            onClick={fetchAll}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-sm hover:bg-slate-800 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </button>
        </div>

        {/* ── Tabs ── */}
        <div className="mt-8 flex gap-1 border-b border-slate-800 overflow-x-auto">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                tab === t.id
                  ? 'border-purple-500 text-white'
                  : 'border-transparent text-slate-500 hover:text-slate-300'
              }`}
            >
              <t.icon className="w-4 h-4" /> {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Contenido ── */}
      <div className="max-w-6xl mx-auto">
        {tab === 'home' && (
          <HomeTab
            stats={stats}
            scans={scans}
            findings={findings}
            onOpen={setSelectedScan}
            onOpenFinding={setSelectedFinding}
            goNew={() => setTab('new')}
          />
        )}
        {tab === 'new' && (
          <NewScanTab
            models={models}
            activeModel={activeModel}
            onCreated={(s) => { setScans([s, ...scans]); setTab('scans'); setSelectedScan(s); }}
          />
        )}
        {tab === 'scans' && <ScansTab scans={scans} onOpen={setSelectedScan} goNew={() => setTab('new')} />}
        {tab === 'findings' && <FindingsTab findings={findings} onOpen={setSelectedFinding} />}
        {tab === 'settings' && <SettingsTab health={health} models={models} activeModel={activeModel} />}
      </div>

      {/* ── Drawer del análisis ── */}
      {selectedScan && (
        <ScanDrawer
          scan={selectedScan}
          events={scanEvents}
          findings={scanFindings}
          onClose={() => { setSelectedScan(null); setScanEvents([]); setScanFindings([]); }}
          onStop={async () => { await api(`/scans/${selectedScan.id}/stop`, { method: 'POST' }); }}
          onOpenFinding={setSelectedFinding}
        />
      )}

      {/* ── Modal de vulnerabilidad ── */}
      {selectedFinding && (
        <FindingModal finding={selectedFinding} onClose={() => setSelectedFinding(null)} />
      )}
    </div>
  );
};

// ── Inicio ──
const BigStat: React.FC<{ icon: React.ComponentType<{ className?: string }>; label: string; value: number; tone: string }> = ({ icon: Icon, label, value, tone }) => (
  <div className={cardCls}>
    <div className="flex items-center gap-3">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${tone}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <div className="text-3xl font-bold">{value}</div>
        <div className="text-xs text-slate-400 uppercase tracking-wide">{label}</div>
      </div>
    </div>
  </div>
);

const HomeTab: React.FC<{
  stats: any; scans: Scan[]; findings: Finding[];
  onOpen: (s: Scan) => void; onOpenFinding: (f: Finding) => void; goNew: () => void;
}> = ({ stats, scans, findings, onOpen, onOpenFinding, goNew }) => (
  <div className="space-y-6">
    {/* Llamada a la acción */}
    {scans.length === 0 ? (
      <div className="bg-gradient-to-br from-purple-900/40 to-fuchsia-900/20 border border-purple-800/40 rounded-2xl p-8 text-center">
        <Sparkles className="w-12 h-12 text-purple-400 mx-auto mb-3" />
        <h2 className="text-2xl font-bold mb-2">Empieza tu primer análisis</h2>
        <p className="text-slate-400 mb-5 max-w-md mx-auto">
          Pega una URL, confirma que tienes permiso para analizarla, y deja que Mythonos haga el trabajo.
          Tu equipo revisa los resultados.
        </p>
        <button onClick={goNew} className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-500 hover:to-fuchsia-500 rounded-xl font-semibold">
          <PlusCircle className="w-5 h-5" /> Nuevo análisis
        </button>
      </div>
    ) : (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <BigStat icon={Activity} label="Trabajando ahora" value={stats.running} tone="bg-emerald-500/15 text-emerald-300" />
        <BigStat icon={CheckCircle2} label="Terminados" value={stats.completed} tone="bg-blue-500/15 text-blue-300" />
        <BigStat icon={AlertTriangle} label="Críticas / Altas" value={stats.criticalCount} tone="bg-red-500/15 text-red-300" />
        <BigStat icon={Bug} label="Total vulnerabilidades" value={stats.totalFindings} tone="bg-purple-500/15 text-purple-300" />
      </div>
    )}

    {/* Análisis recientes */}
    {scans.length > 0 && (
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Análisis recientes</h2>
          <button onClick={goNew} className="flex items-center gap-1 text-sm text-purple-400 hover:text-purple-300">
            <PlusCircle className="w-4 h-4" /> Nuevo
          </button>
        </div>
        <div className="space-y-3">
          {scans.slice(0, 5).map(s => <ScanCard key={s.id} scan={s} onOpen={() => onOpen(s)} />)}
        </div>
      </div>
    )}

    {/* Vulnerabilidades recientes */}
    {findings.length > 0 && (
      <div>
        <h2 className="text-lg font-semibold mb-3">Últimas vulnerabilidades encontradas</h2>
        <div className="space-y-2">
          {findings.slice(0, 5).map(f => (
            <FindingRow key={f.id} finding={f} onClick={() => onOpenFinding(f)} />
          ))}
        </div>
      </div>
    )}
  </div>
);

// ── Tarjeta de análisis ──
const ScanCard: React.FC<{ scan: Scan; onOpen: () => void }> = ({ scan, onOpen }) => {
  const url = scan.target.url || (scan.target.hosts && scan.target.hosts[0]) || '—';
  return (
    <button
      onClick={onOpen}
      className="w-full text-left bg-slate-900/60 hover:bg-slate-900 border border-slate-800 hover:border-purple-500/40 rounded-2xl p-5 transition-colors"
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center shrink-0">
            {scan.target.type === 'web' ? <Globe className="w-5 h-5 text-purple-300" />
              : scan.target.type === 'api' ? <Plug className="w-5 h-5 text-purple-300" />
              : <Server className="w-5 h-5 text-purple-300" />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-semibold truncate">{scan.name}</div>
            <div className="text-xs text-slate-500 truncate">{url} · {timeAgo(scan.createdAt)}</div>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {scan.findingsCount > 0 && (
            <div className="flex items-center gap-1 text-sm text-red-300">
              <Bug className="w-4 h-4" /> {scan.findingsCount}
            </div>
          )}
          <span className={`inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border ${STATUS_COLOR[scan.status]}`}>
            <StatusIcon s={scan.status} className="w-3 h-3" /> {STATUS_LABEL[scan.status]}
          </span>
          <ChevronRight className="w-4 h-4 text-slate-600" />
        </div>
      </div>
    </button>
  );
};

// ── Fila de vulnerabilidad (compact) ──
const FindingRow: React.FC<{ finding: Finding; onClick: () => void }> = ({ finding, onClick }) => (
  <button
    onClick={onClick}
    className="w-full flex items-center gap-3 p-4 bg-slate-900/60 hover:bg-slate-900 border border-slate-800 hover:border-purple-500/40 rounded-xl text-left transition-colors"
  >
    <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${SEV_COLOR[finding.severity]}`}>
      {SEV_LABEL[finding.severity]}
    </span>
    <div className="flex-1 min-w-0">
      <div className="font-medium truncate">{finding.title}</div>
      {finding.location && <div className="text-xs text-slate-500 truncate">{finding.location}</div>}
    </div>
    <div className="text-xs text-slate-500 shrink-0">{timeAgo(finding.createdAt)}</div>
    <ChevronRight className="w-4 h-4 text-slate-600 shrink-0" />
  </button>
);

// ── Nuevo análisis ──
const NewScanTab: React.FC<{ models: ModelInfo[]; activeModel: string; onCreated: (s: Scan) => void }> = ({ models, activeModel, onCreated }) => {
  const [form, setForm] = useState({
    name: '',
    type: 'web' as TargetType,
    url: '',
    intensity: 'active' as Intensity,
    authorized: false,
    // avanzadas:
    client: '',
    hosts: '',
    inScope: '',
    outOfScope: '',
    hasAuth: false,
    loginUrl: '',
    username: '',
    password: '',
    cookie: '',
    token: '',
    technologies: '',
    notes: '',
    objective: 'Pentest completo siguiendo OWASP Top 10. Validar cada hallazgo con prueba real.',
    model: activeModel,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => { setForm(f => ({ ...f, model: activeModel })); }, [activeModel]);

  const submit = async () => {
    setError(null);
    if (!form.authorized) {
      setError('Necesitas confirmar que tienes permiso del dueño del sistema antes de empezar.');
      return;
    }
    if (!form.url.trim() && !form.hosts.trim()) {
      setError('Indica al menos una dirección (URL o IP).');
      return;
    }
    setSubmitting(true);
    try {
      const target: Target = { type: form.type };
      if (form.url.trim()) target.url = form.url.trim();
      const hostList = form.hosts.split(/[\s,;\n]+/).map(h => h.trim()).filter(Boolean);
      if (hostList.length) target.hosts = hostList;

      const auth = form.hasAuth
        ? {
            loginUrl: form.loginUrl || undefined,
            username: form.username || undefined,
            password: form.password || undefined,
            cookie: form.cookie || undefined,
            token: form.token || undefined,
          }
        : null;

      const engagement: Engagement = {
        authorized: form.authorized,
        client: form.client || undefined,
        intensity: form.intensity,
        inScope: form.inScope,
        outOfScope: form.outOfScope,
        auth,
        technologies: form.technologies,
        notes: form.notes,
      };

      const res = await api('/scans', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name || `Análisis ${new Date().toLocaleDateString()}`,
          target, engagement,
          objective: form.objective,
          model: form.model,
        }),
      });
      if (!res.ok) {
        setError((await res.json()).error || `Error ${res.status}`);
        return;
      }
      onCreated(await res.json());
    } catch (e) {
      setError(String(e));
    } finally {
      setSubmitting(false);
    }
  };

  const intensityOptions: { id: Intensity; icon: React.ComponentType<{ className?: string }>; title: string; desc: string; tone: string }[] = [
    { id: 'passive',    icon: Eye,    title: 'Solo mirar',   desc: 'Inspección pasiva. No deja huella en el sistema.', tone: 'border-emerald-500/40 bg-emerald-500/5 text-emerald-300' },
    { id: 'active',     icon: Search, title: 'Buscar',       desc: 'Escaneo estándar. Encuentra la mayoría de problemas.', tone: 'border-amber-500/40 bg-amber-500/5 text-amber-300' },
    { id: 'aggressive', icon: Swords, title: 'Atacar',       desc: 'Incluye explotación real. Solo con permiso explícito.', tone: 'border-red-500/40 bg-red-500/5 text-red-300' },
  ];

  const targetOptions: { id: TargetType; icon: React.ComponentType<{ className?: string }>; title: string; desc: string }[] = [
    { id: 'web',     icon: Globe,  title: 'Web',  desc: 'Una página o aplicación web' },
    { id: 'api',     icon: Plug,   title: 'API',  desc: 'Un servicio o endpoint REST/GraphQL' },
    { id: 'network', icon: Server, title: 'Red',  desc: 'Un servidor, IP o rango de red' },
  ];

  return (
    <div className="max-w-3xl space-y-6">
      {/* Paso 1: nombre */}
      <div className={cardCls}>
        <div className="flex items-center gap-2 mb-4">
          <span className="w-7 h-7 rounded-full bg-purple-600 text-white flex items-center justify-center text-sm font-bold">1</span>
          <h3 className="text-base font-semibold">¿Qué vas a analizar?</h3>
        </div>
        <div className="space-y-4">
          <div>
            <label className={labelCls}>Ponle un nombre</label>
            <input className={inputCls} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Por ejemplo: Análisis de acme.com" />
          </div>
          <div>
            <label className={labelCls}>¿Qué tipo es?</label>
            <div className="grid grid-cols-3 gap-3">
              {targetOptions.map(o => (
                <button
                  key={o.id}
                  onClick={() => setForm({ ...form, type: o.id })}
                  className={`p-4 rounded-xl border text-left transition-colors ${form.type === o.id ? 'border-purple-500 bg-purple-500/10 text-purple-200' : 'border-slate-800 bg-slate-900 text-slate-400 hover:border-slate-700'}`}
                >
                  <o.icon className="w-5 h-5 mb-2" />
                  <div className="font-semibold text-sm">{o.title}</div>
                  <div className="text-xs opacity-70 mt-0.5">{o.desc}</div>
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className={labelCls}>Dirección a analizar</label>
            <input
              className={inputCls}
              value={form.url}
              onChange={e => setForm({ ...form, url: e.target.value })}
              placeholder={form.type === 'network' ? '192.168.1.100' : 'https://www.acme.com'}
            />
            <p className="text-xs text-slate-500 mt-2">
              Solo el dominio principal o IP. Las páginas internas las descubre el agente.
            </p>
          </div>
        </div>
      </div>

      {/* Paso 2: cómo trabajar */}
      <div className={cardCls}>
        <div className="flex items-center gap-2 mb-4">
          <span className="w-7 h-7 rounded-full bg-purple-600 text-white flex items-center justify-center text-sm font-bold">2</span>
          <h3 className="text-base font-semibold">¿Cómo quieres que trabaje?</h3>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {intensityOptions.map(o => (
            <button
              key={o.id}
              onClick={() => setForm({ ...form, intensity: o.id })}
              className={`p-4 rounded-xl border text-left transition-colors ${form.intensity === o.id ? o.tone : 'border-slate-800 bg-slate-900 text-slate-400 hover:border-slate-700'}`}
            >
              <o.icon className="w-5 h-5 mb-2" />
              <div className="font-semibold text-sm">{o.title}</div>
              <div className="text-xs opacity-80 mt-0.5">{o.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Paso 3: permiso */}
      <div className={cardCls}>
        <div className="flex items-center gap-2 mb-4">
          <span className="w-7 h-7 rounded-full bg-purple-600 text-white flex items-center justify-center text-sm font-bold">3</span>
          <h3 className="text-base font-semibold">Confirma que tienes permiso</h3>
        </div>
        <label className="flex items-start gap-3 p-4 bg-red-950/20 border border-red-900/40 rounded-xl cursor-pointer hover:bg-red-950/30">
          <input
            type="checkbox"
            checked={form.authorized}
            onChange={e => setForm({ ...form, authorized: e.target.checked })}
            className="mt-1 w-5 h-5"
          />
          <div className="text-sm">
            <div className="font-semibold text-slate-100">
              Tengo autorización por escrito del dueño del sistema para analizarlo
            </div>
            <div className="text-xs text-slate-400 mt-1">
              Sin esto, Mythonos no ejecuta ninguna acción. La confirmación queda guardada como evidencia legal.
            </div>
          </div>
        </label>
      </div>

      {/* Opciones avanzadas (colapsable) */}
      <div className={cardCls}>
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="w-full flex items-center justify-between text-left"
        >
          <div className="flex items-center gap-2">
            <SettingsIcon className="w-4 h-4 text-slate-500" />
            <span className="text-sm font-medium text-slate-300">Opciones avanzadas</span>
            <span className="text-xs text-slate-500">(opcional)</span>
          </div>
          <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
        </button>

        {showAdvanced && (
          <div className="mt-5 space-y-5 pt-5 border-t border-slate-800">
            <div>
              <label className={labelCls}>Cliente (opcional)</label>
              <input className={inputCls} value={form.client} onChange={e => setForm({ ...form, client: e.target.value })} placeholder="Empresa cliente" />
            </div>

            <div>
              <label className={labelCls}>Direcciones adicionales</label>
              <textarea
                className={inputCls}
                rows={2}
                value={form.hosts}
                onChange={e => setForm({ ...form, hosts: e.target.value })}
                placeholder="api.acme.com, 10.0.0.5"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Qué SÍ revisar</label>
                <textarea
                  className={inputCls}
                  rows={3}
                  value={form.inScope}
                  onChange={e => setForm({ ...form, inScope: e.target.value })}
                  placeholder="*.acme.com, formulario de login"
                />
              </div>
              <div>
                <label className={labelCls}>Qué NO tocar</label>
                <textarea
                  className={inputCls}
                  rows={3}
                  value={form.outOfScope}
                  onChange={e => setForm({ ...form, outOfScope: e.target.value })}
                  placeholder="admin.acme.com, infra compartida"
                />
              </div>
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={form.hasAuth} onChange={e => setForm({ ...form, hasAuth: e.target.checked })} />
                <span>El sistema requiere usuario y contraseña</span>
              </label>
              {form.hasAuth && (
                <div className="mt-3 space-y-3 pl-6 border-l-2 border-slate-800">
                  <input className={inputCls} placeholder="URL de login" value={form.loginUrl} onChange={e => setForm({ ...form, loginUrl: e.target.value })} />
                  <div className="grid grid-cols-2 gap-3">
                    <input className={inputCls} placeholder="Usuario" value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} />
                    <input className={inputCls} type="password" placeholder="Contraseña" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
                  </div>
                  <input className={inputCls} placeholder="Cookie de sesión (opcional)" value={form.cookie} onChange={e => setForm({ ...form, cookie: e.target.value })} />
                  <input className={inputCls} placeholder="Bearer token (opcional)" value={form.token} onChange={e => setForm({ ...form, token: e.target.value })} />
                </div>
              )}
            </div>

            <div>
              <label className={labelCls}>Tecnologías que usa el sistema</label>
              <textarea
                className={inputCls}
                rows={2}
                value={form.technologies}
                onChange={e => setForm({ ...form, technologies: e.target.value })}
                placeholder="React, Spring Boot, PostgreSQL..."
              />
            </div>

            <div>
              <label className={labelCls}>Notas para el agente</label>
              <textarea
                className={inputCls}
                rows={3}
                value={form.notes}
                onChange={e => setForm({ ...form, notes: e.target.value })}
                placeholder="Cosas en las que quieres que se enfoque especialmente..."
              />
            </div>

            <div>
              <label className={labelCls}>Cerebro a usar</label>
              <select className={inputCls} value={form.model} onChange={e => setForm({ ...form, model: e.target.value })}>
                {models.map(m => (
                  <option key={m.id} value={m.id} disabled={!m.available}>
                    {m.label} {m.available ? '' : '(aún no disponible)'}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="text-sm text-red-300 bg-red-950/40 border border-red-900 rounded-xl p-4 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /> {error}
        </div>
      )}

      <button
        onClick={submit}
        disabled={submitting}
        className="w-full py-4 bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-500 hover:to-fuchsia-500 rounded-xl text-white font-semibold text-base flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-purple-900/30"
      >
        {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5" />}
        {submitting ? 'Iniciando análisis...' : 'Empezar análisis'}
      </button>
    </div>
  );
};

// ── Lista de análisis ──
const ScansTab: React.FC<{ scans: Scan[]; onOpen: (s: Scan) => void; goNew: () => void }> = ({ scans, onOpen, goNew }) => {
  if (scans.length === 0) {
    return (
      <div className="text-center py-16">
        <ListChecks className="w-12 h-12 text-slate-700 mx-auto mb-3" />
        <p className="text-slate-400 mb-4">Aún no has hecho ningún análisis.</p>
        <button onClick={goNew} className="inline-flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-500 rounded-xl text-white font-medium">
          <PlusCircle className="w-4 h-4" /> Crear el primero
        </button>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {scans.map(s => <ScanCard key={s.id} scan={s} onOpen={() => onOpen(s)} />)}
    </div>
  );
};

// ── Vulnerabilidades ──
const FindingsTab: React.FC<{ findings: Finding[]; onOpen: (f: Finding) => void }> = ({ findings, onOpen }) => {
  if (findings.length === 0) {
    return (
      <div className="text-center py-16">
        <ShieldCheck className="w-12 h-12 text-emerald-500/40 mx-auto mb-3" />
        <p className="text-slate-400">No hay vulnerabilidades reportadas todavía.</p>
        <p className="text-xs text-slate-600 mt-1">Aparecerán aquí cuando un análisis encuentre algo.</p>
      </div>
    );
  }

  // Agrupar por severidad
  const order: Severity[] = ['critical', 'high', 'medium', 'low', 'info'];
  const groups = order.map(sev => ({ sev, items: findings.filter(f => f.severity === sev) })).filter(g => g.items.length > 0);

  return (
    <div className="space-y-6">
      {groups.map(g => (
        <div key={g.sev}>
          <div className="flex items-center gap-2 mb-3">
            <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${SEV_COLOR[g.sev]}`}>
              {SEV_LABEL[g.sev]}
            </span>
            <span className="text-xs text-slate-500">{g.items.length} {g.items.length === 1 ? 'vulnerabilidad' : 'vulnerabilidades'}</span>
          </div>
          <div className="space-y-2">
            {g.items.map(f => <FindingRow key={f.id} finding={f} onClick={() => onOpen(f)} />)}
          </div>
        </div>
      ))}
    </div>
  );
};

// ── Ajustes ──
const SettingsTab: React.FC<{ health: any; models: ModelInfo[]; activeModel: string }> = ({ health, models, activeModel }) => {
  const active = models.find(m => m.id === activeModel);
  return (
    <div className="space-y-4 max-w-2xl">
      <div className={cardCls}>
        <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-4">Estado del sistema</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between py-2 border-b border-slate-800">
            <span className="text-slate-400">Motor de análisis</span>
            <span className={`flex items-center gap-2 text-sm ${health?.ok ? 'text-emerald-400' : 'text-red-400'}`}>
              <span className={`w-2 h-2 rounded-full ${health?.ok ? 'bg-emerald-400' : 'bg-red-400'}`} />
              {health?.ok ? 'Funcionando' : 'Sin conexión'}
            </span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-slate-800">
            <span className="text-slate-400">Clave del modelo</span>
            <span className={`text-sm ${health?.hasApiKey ? 'text-emerald-400' : 'text-red-400'}`}>
              {health?.hasApiKey ? '✓ Configurada' : '✗ Sin configurar'}
            </span>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-slate-400">Cerebro activo</span>
            <span className="text-sm text-purple-300 font-medium">{active?.label || activeModel}</span>
          </div>
        </div>
      </div>

      <div className={cardCls}>
        <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-4">Cerebros disponibles</h3>
        <div className="space-y-2">
          {models.map(m => (
            <div key={m.id} className={`p-4 rounded-xl border ${m.id === activeModel ? 'border-purple-500/50 bg-purple-500/5' : 'border-slate-800 bg-slate-950'}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="font-medium">{m.label}</div>
                  {m.id === activeModel && <span className="text-[10px] uppercase bg-purple-600 px-2 py-0.5 rounded-full text-white">en uso</span>}
                  {!m.available && <span className="text-[10px] uppercase bg-slate-700 px-2 py-0.5 rounded-full">próximamente</span>}
                </div>
              </div>
              <div className="text-xs text-slate-400 mt-1">{m.description}</div>
            </div>
          ))}
        </div>
        <p className="text-xs text-slate-500 mt-4 leading-relaxed">
          Cuando salga Mythos al público, el equipo técnico lo activa cambiando una variable.
          Aparecerá aquí automáticamente.
        </p>
      </div>
    </div>
  );
};

// ── Drawer del análisis ──
const ScanDrawer: React.FC<{
  scan: Scan; events: AgentEvent[]; findings: Finding[];
  onClose: () => void; onStop: () => void; onOpenFinding: (f: Finding) => void;
}> = ({ scan, events, findings, onClose, onStop, onOpenFinding }) => {
  const url = scan.target.url || (scan.target.hosts && scan.target.hosts[0]) || '';

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/70" onClick={onClose} />
      <div className="w-full max-w-2xl bg-slate-950 border-l border-slate-800 overflow-y-auto">
        {/* Cabecera */}
        <div className="sticky top-0 bg-slate-950/95 backdrop-blur border-b border-slate-800 px-6 py-5 z-10">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h2 className="text-xl font-bold truncate">{scan.name}</h2>
              <div className="text-sm text-slate-400 truncate mt-0.5">{url}</div>
              <div className="flex items-center gap-3 mt-3 flex-wrap">
                <span className={`inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border ${STATUS_COLOR[scan.status]}`}>
                  <StatusIcon s={scan.status} className="w-3 h-3" /> {STATUS_LABEL[scan.status]}
                </span>
                {scan.findingsCount > 0 && (
                  <span className="inline-flex items-center gap-1 text-xs text-red-300">
                    <Bug className="w-3 h-3" /> {scan.findingsCount} {scan.findingsCount === 1 ? 'vulnerabilidad' : 'vulnerabilidades'}
                  </span>
                )}
                <span className="text-xs text-slate-500">{timeAgo(scan.createdAt)}</span>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {(scan.status === 'running' || scan.status === 'queued') && (
                <button onClick={onStop} className="px-3 py-1.5 bg-red-600/20 border border-red-600/40 rounded-lg text-xs text-red-300 hover:bg-red-600/30 flex items-center gap-1">
                  <Square className="w-3 h-3" /> Detener
                </button>
              )}
              <button onClick={onClose} className="p-2 hover:bg-slate-900 rounded-lg"><X className="w-4 h-4" /></button>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Estado en lenguaje natural */}
          {scan.status === 'running' && (
            <div className="bg-emerald-500/5 border border-emerald-500/30 rounded-xl p-4 flex items-center gap-3">
              <Loader2 className="w-5 h-5 text-emerald-400 animate-spin shrink-0" />
              <div className="text-sm text-emerald-200">
                Mythonos está trabajando en el análisis. Puedes cerrar esta ventana, el trabajo continúa en segundo plano.
              </div>
            </div>
          )}

          {scan.summary && scan.status === 'completed' && (
            <div className="bg-blue-500/5 border border-blue-500/30 rounded-xl p-4">
              <div className="text-xs uppercase text-blue-300 mb-2 font-semibold">Resumen del análisis</div>
              <div className="text-sm text-slate-200 whitespace-pre-wrap">{scan.summary}</div>
            </div>
          )}

          {scan.error && (
            <div className="bg-red-950/40 border border-red-900/60 rounded-xl p-4">
              <div className="text-xs uppercase text-red-300 mb-1 font-semibold">El análisis tuvo un problema</div>
              <div className="text-sm text-red-200">{scan.error}</div>
            </div>
          )}

          {/* Vulnerabilidades */}
          {findings.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                <Bug className="w-4 h-4 text-red-400" /> Vulnerabilidades encontradas
              </h3>
              <div className="space-y-2">
                {findings.map(f => <FindingRow key={f.id} finding={f} onClick={() => onOpenFinding(f)} />)}
              </div>
            </div>
          )}

          {/* Actividad del agente */}
          <div>
            <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
              <Activity className="w-4 h-4 text-purple-400" /> Lo que está haciendo el agente
            </h3>
            {events.length === 0 ? (
              <div className="text-sm text-slate-500 text-center py-6">Esperando primera acción...</div>
            ) : (
              <div className="space-y-1">
                {events.slice().reverse().map((e, i) => {
                  const d = describeEvent(e);
                  return (
                    <div key={i} className="flex items-start gap-3 text-sm py-1.5">
                      <span className="text-base shrink-0 w-6 text-center">{d.icon}</span>
                      <span className={`${d.tone} flex-1`}>{d.text}</span>
                      <span className="text-[10px] text-slate-600 shrink-0 mt-1">{e.ts?.slice(11, 16)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Modal de vulnerabilidad ──
const FindingModal: React.FC<{ finding: Finding; onClose: () => void }> = ({ finding, onClose }) => (
  <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70" onClick={onClose}>
    <div className="bg-slate-950 border border-slate-800 rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
      <div className="sticky top-0 bg-slate-950/95 backdrop-blur border-b border-slate-800 px-6 py-5 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${SEV_COLOR[finding.severity]}`}>
              {SEV_LABEL[finding.severity]}
            </span>
            {finding.cwe && <span className="text-xs text-slate-500">{finding.cwe}</span>}
            <span className="text-xs text-slate-500">Confianza: {finding.confidence === 'high' ? 'alta' : finding.confidence === 'medium' ? 'media' : 'baja'}</span>
          </div>
          <h2 className="text-xl font-bold">{finding.title}</h2>
          {finding.location && <div className="text-sm text-slate-400 mt-1 break-all">{finding.location}</div>}
        </div>
        <button onClick={onClose} className="p-2 hover:bg-slate-900 rounded-lg shrink-0"><X className="w-4 h-4" /></button>
      </div>
      <div className="p-6 space-y-5">
        <Section title="Qué es y por qué importa" content={finding.description} />
        <Section title="Cómo reproducirlo" content={finding.reproduction} mono />
        <Section title="Prueba de concepto" content={finding.poc} mono />
      </div>
    </div>
  </div>
);

const Section: React.FC<{ title: string; content: string; mono?: boolean }> = ({ title, content, mono }) => (
  <div>
    <div className="text-xs uppercase text-slate-500 mb-2 font-semibold tracking-wide">{title}</div>
    <div className={`bg-slate-900 border border-slate-800 rounded-xl p-4 whitespace-pre-wrap ${mono ? 'font-mono text-xs' : 'text-sm text-slate-200'}`}>
      {content || 'Sin información'}
    </div>
  </div>
);

export default Mythonos;
