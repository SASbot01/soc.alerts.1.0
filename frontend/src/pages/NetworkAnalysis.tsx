import React, { useEffect, useState, useCallback } from 'react';
import {
  Network, ShieldX, BarChart2, RefreshCw, Filter,
  ChevronLeft, ChevronRight, Activity, Globe
} from 'lucide-react';
import api from '../lib/api';

interface NetFlow {
  id: string;
  timestamp: string;
  srcIp: string;
  dstIp: string;
  srcPort: number;
  dstPort: number;
  protocol: string;
  bytesSent: number;
  bytesRecv: number;
  duration: number;
  threatType: string | null;
}

interface TopTalker {
  ip: string;
  totalBytes: number;
}

interface ProtocolStat {
  protocol: string;
  count: number;
  totalBytes: number;
}

interface NetStats {
  totalFlows: number;
  threatFlows: number;
  totalBytesTransferred: number;
  activeProtocols: number;
}

const protocolBadge = (proto: string) => {
  const map: Record<string, string> = {
    TCP: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    UDP: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
    ICMP: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    HTTP: 'bg-green-500/10 text-green-400 border-green-500/20',
    HTTPS: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    DNS: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  };
  return `border ${map[proto.toUpperCase()] ?? 'bg-slate-700/50 text-slate-300 border-slate-600'}`;
};

const fmtBytes = (bytes: number) => {
  if (bytes >= 1_073_741_824) return `${(bytes / 1_073_741_824).toFixed(1)} GB`;
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
};

const fmt = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'medium' });

const toInputDate = (d: Date) => d.toISOString().slice(0, 16);

type Tab = 'traffic' | 'threats' | 'analytics';

const FlowsTable: React.FC<{ flows: NetFlow[]; loading: boolean }> = ({ flows, loading }) => {
  if (loading) return <div className="flex items-center justify-center h-40 text-slate-400 text-sm">Loading flows...</div>;
  if (flows.length === 0) return <div className="flex items-center justify-center h-40 text-slate-500 text-sm">No flows found.</div>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-slate-400 border-b border-slate-700">
            <th className="px-4 py-3 text-left font-medium">Timestamp</th>
            <th className="px-4 py-3 text-left font-medium">Src IP:Port</th>
            <th className="px-4 py-3 text-left font-medium">Dst IP:Port</th>
            <th className="px-4 py-3 text-left font-medium">Proto</th>
            <th className="px-4 py-3 text-left font-medium">Sent</th>
            <th className="px-4 py-3 text-left font-medium">Recv</th>
            <th className="px-4 py-3 text-left font-medium">Duration</th>
            <th className="px-4 py-3 text-left font-medium">Threat</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-700/50">
          {flows.map(f => (
            <tr key={f.id} className="hover:bg-slate-800/40 transition-colors">
              <td className="px-4 py-3 text-slate-400 text-xs font-mono whitespace-nowrap">{fmt(f.timestamp)}</td>
              <td className="px-4 py-3 text-slate-300 text-xs font-mono">{f.srcIp}:{f.srcPort}</td>
              <td className="px-4 py-3 text-slate-300 text-xs font-mono">{f.dstIp}:{f.dstPort}</td>
              <td className="px-4 py-3">
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${protocolBadge(f.protocol)}`}>
                  {f.protocol}
                </span>
              </td>
              <td className="px-4 py-3 text-slate-300 text-xs">{fmtBytes(f.bytesSent)}</td>
              <td className="px-4 py-3 text-slate-300 text-xs">{fmtBytes(f.bytesRecv)}</td>
              <td className="px-4 py-3 text-slate-400 text-xs">{f.duration}s</td>
              <td className="px-4 py-3">
                {f.threatType ? (
                  <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20">
                    {f.threatType}
                  </span>
                ) : (
                  <span className="text-slate-600 text-xs">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const NetworkAnalysis: React.FC = () => {
  const companyId = (JSON.parse(localStorage.getItem('user') || '{}') as { companyId?: string }).companyId;

  const [tab, setTab] = useState<Tab>('traffic');
  const [flows, setFlows] = useState<NetFlow[]>([]);
  const [threats, setThreats] = useState<NetFlow[]>([]);
  const [topTalkers, setTopTalkers] = useState<TopTalker[]>([]);
  const [protocols, setProtocols] = useState<ProtocolStat[]>([]);
  const [stats, setStats] = useState<NetStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const now = new Date();
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);
  const [from, setFrom] = useState(toInputDate(dayStart));
  const [to, setTo] = useState(toInputDate(now));

  const loadStats = useCallback(async () => {
    try {
      const r = await api.get('/network/stats', { params: { companyId } });
      setStats(r.data);
    } catch (e) {
      console.error('Failed to load network stats', e);
    }
  }, [companyId]);

  const loadFlows = useCallback(async () => {
    setLoading(true);
    try {
      const params = { companyId, from: new Date(from).toISOString(), to: new Date(to).toISOString(), page, size: 50 };
      const [fr, tr] = await Promise.all([
        api.get('/network/flows', { params }),
        api.get('/network/threats', { params: { companyId } }),
      ]);
      const flowData = fr.data;
      setFlows(Array.isArray(flowData) ? flowData : flowData.content ?? flowData.flows ?? []);
      setTotalPages(Array.isArray(flowData) ? 1 : flowData.totalPages ?? 1);
      setThreats(Array.isArray(tr.data) ? tr.data : tr.data.content ?? []);
    } catch (e) {
      console.error('Failed to load flows', e);
    } finally {
      setLoading(false);
    }
  }, [companyId, from, to, page]);

  const loadAnalytics = useCallback(async () => {
    setAnalyticsLoading(true);
    try {
      const [tt, pr] = await Promise.all([
        api.get('/network/top-talkers', { params: { companyId, limit: 10 } }),
        api.get('/network/protocols', { params: { companyId } }),
      ]);
      setTopTalkers(Array.isArray(tt.data) ? tt.data : tt.data.topTalkers ?? []);
      setProtocols(Array.isArray(pr.data) ? pr.data : pr.data.protocols ?? []);
    } catch (e) {
      console.error('Failed to load analytics', e);
    } finally {
      setAnalyticsLoading(false);
    }
  }, [companyId]);

  useEffect(() => { loadStats(); }, [loadStats]);
  useEffect(() => { loadFlows(); }, [loadFlows]);
  useEffect(() => { if (tab === 'analytics') loadAnalytics(); }, [tab, loadAnalytics]);

  const maxBytes = topTalkers.reduce((m, t) => Math.max(m, t.totalBytes), 1);
  const maxProtoCount = protocols.reduce((m, p) => Math.max(m, p.count), 1);

  const statCards = [
    { label: 'Total Flows', value: stats?.totalFlows ?? 0, color: 'text-blue-400', icon: <Network className="w-5 h-5 text-blue-400" /> },
    { label: 'Threat Flows', value: stats?.threatFlows ?? 0, color: 'text-red-400', icon: <ShieldX className="w-5 h-5 text-red-400" /> },
    { label: 'Bytes Transferred', value: fmtBytes(stats?.totalBytesTransferred ?? 0), color: 'text-white', icon: <Activity className="w-5 h-5 text-slate-400" /> },
    { label: 'Active Protocols', value: stats?.activeProtocols ?? 0, color: 'text-purple-400', icon: <Globe className="w-5 h-5 text-purple-400" /> },
  ];

  const tabs: { id: Tab; label: string }[] = [
    { id: 'traffic', label: 'Traffic' },
    { id: 'threats', label: 'Threats' },
    { id: 'analytics', label: 'Analytics' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Network className="w-7 h-7 text-blue-400" />
            Network Traffic Analysis
          </h1>
          <p className="text-slate-400 text-sm mt-1">Network Detection &amp; Response — flow analysis, threat detection, and traffic insights</p>
        </div>
        <button
          onClick={() => { loadStats(); loadFlows(); if (tab === 'analytics') loadAnalytics(); }}
          className="flex items-center gap-2 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-300 hover:text-white hover:border-slate-500 transition-colors text-sm"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(card => (
          <div key={card.label} className="bg-slate-900 border border-slate-700 rounded-lg p-4">
            <div className="flex items-center gap-2 text-slate-400 text-sm mb-2">
              {card.icon}
              {card.label}
            </div>
            <div className={`text-3xl font-bold ${card.color}`}>
              {typeof card.value === 'number' ? card.value.toLocaleString() : card.value}
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-slate-900 border border-slate-700 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-3 text-slate-300 text-sm font-medium">
          <Filter className="w-4 h-4" />
          Date Range
        </div>
        <div className="flex flex-wrap gap-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">From</label>
            <input
              type="datetime-local"
              value={from}
              onChange={e => { setFrom(e.target.value); setPage(0); }}
              className="bg-slate-800 border border-slate-600 rounded-md px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">To</label>
            <input
              type="datetime-local"
              value={to}
              onChange={e => { setTo(e.target.value); setPage(0); }}
              className="bg-slate-800 border border-slate-600 rounded-md px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Tabs + Content */}
      <div className="bg-slate-900 border border-slate-700 rounded-lg overflow-hidden">
        <div className="border-b border-slate-700 flex">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-5 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
                tab === t.id
                  ? 'border-blue-500 text-blue-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              {t.label}
              {t.id === 'threats' && threats.length > 0 && (
                <span className="ml-2 px-1.5 py-0.5 bg-red-500/10 text-red-400 rounded text-xs">{threats.length}</span>
              )}
            </button>
          ))}
        </div>

        {(tab === 'traffic') && (
          <>
            <FlowsTable flows={flows} loading={loading} />
            {totalPages > 1 && (
              <div className="px-4 py-3 border-t border-slate-700 flex items-center justify-between">
                <span className="text-xs text-slate-400">Page {page + 1} of {totalPages}</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(0, p - 1))}
                    disabled={page === 0}
                    className="p-1.5 rounded bg-slate-800 border border-slate-700 text-slate-300 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                    disabled={page >= totalPages - 1}
                    className="p-1.5 rounded bg-slate-800 border border-slate-700 text-slate-300 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {tab === 'threats' && (
          <>
            <div className="px-4 py-3 border-b border-slate-700 text-xs text-slate-400 flex items-center gap-2">
              <ShieldX className="w-4 h-4 text-red-400" />
              Showing only flows with identified threat types
            </div>
            <FlowsTable flows={threats} loading={loading} />
          </>
        )}

        {tab === 'analytics' && (
          <div className="p-6 space-y-8">
            {analyticsLoading ? (
              <div className="flex items-center justify-center h-40 text-slate-400 text-sm">Loading analytics...</div>
            ) : (
              <>
                {/* Top Talkers */}
                <div>
                  <h3 className="text-sm font-semibold text-slate-200 mb-4 flex items-center gap-2">
                    <BarChart2 className="w-4 h-4 text-blue-400" />
                    Top Talkers (by bytes)
                  </h3>
                  {topTalkers.length === 0 ? (
                    <p className="text-slate-500 text-sm">No data available.</p>
                  ) : (
                    <div className="space-y-3">
                      {topTalkers.map((t, i) => (
                        <div key={t.ip}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-mono text-slate-300">{t.ip}</span>
                            <span className="text-xs text-slate-400">{fmtBytes(t.totalBytes)}</span>
                          </div>
                          <div className="w-full bg-slate-800 rounded-full h-2">
                            <div
                              className="bg-blue-500 h-2 rounded-full transition-all"
                              style={{ width: `${(t.totalBytes / maxBytes) * 100}%` }}
                            />
                          </div>
                          {i < topTalkers.length - 1 && <div className="mt-1" />}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Protocol Distribution */}
                <div>
                  <h3 className="text-sm font-semibold text-slate-200 mb-4 flex items-center gap-2">
                    <Activity className="w-4 h-4 text-purple-400" />
                    Protocol Distribution
                  </h3>
                  {protocols.length === 0 ? (
                    <p className="text-slate-500 text-sm">No data available.</p>
                  ) : (
                    <div className="space-y-3">
                      {protocols.map(p => (
                        <div key={p.protocol}>
                          <div className="flex items-center justify-between mb-1">
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${protocolBadge(p.protocol)}`}>
                              {p.protocol}
                            </span>
                            <div className="text-xs text-slate-400">
                              {p.count.toLocaleString()} flows &middot; {fmtBytes(p.totalBytes)}
                            </div>
                          </div>
                          <div className="w-full bg-slate-800 rounded-full h-2">
                            <div
                              className="bg-purple-500 h-2 rounded-full transition-all"
                              style={{ width: `${(p.count / maxProtoCount) * 100}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default NetworkAnalysis;
