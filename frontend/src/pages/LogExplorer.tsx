import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { Search, Database, Activity, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';

interface LogEntry {
  id: string;
  timestamp: string;
  source: string;
  severity: string;
  srcIp: string;
  dstIp: string;
  action: string;
  category: string;
  message?: string;
}

interface LogStats {
  totalToday: number;
  activeSources: number;
  eventsPerSec: number;
}

interface LogPage {
  content: LogEntry[];
  totalElements: number;
  totalPages: number;
  number: number;
}

const severityBadge = (severity: string) => {
  const s = severity?.toLowerCase();
  if (s === 'critical') return 'bg-red-600 text-white';
  if (s === 'high') return 'bg-red-500/20 text-red-400 border border-red-500/40';
  if (s === 'medium') return 'bg-amber-500/20 text-amber-400 border border-amber-500/40';
  if (s === 'low') return 'bg-blue-500/20 text-blue-400 border border-blue-500/40';
  return 'bg-slate-700 text-slate-300';
};

const LogExplorer: React.FC = () => {
  const { user } = useAuth();
  const companyId = user?.companyId;
  const token = localStorage.getItem('token');

  const [query, setQuery] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [page, setPage] = useState(0);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [stats, setStats] = useState<LogStats>({ totalToday: 0, activeSources: 0, eventsPerSec: 0 });
  const [loading, setLoading] = useState(false);
  const [statsLoading, setStatsLoading] = useState(true);

  const api = (path: string, opts?: RequestInit) =>
    fetch(`/api/v1${path}`, {
      ...opts,
      headers: {
        ...opts?.headers,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

  const fetchStats = useCallback(async () => {
    if (!companyId) return;
    setStatsLoading(true);
    try {
      const res = await api(`/logs/stats?companyId=${companyId}`);
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.error('Failed to load log stats:', err);
    } finally {
      setStatsLoading(false);
    }
  }, [companyId, token]);

  const fetchLogs = useCallback(async (p = 0) => {
    if (!companyId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        companyId,
        page: String(p),
        size: '50',
      });
      if (query) params.set('query', query);
      if (fromDate) params.set('from', fromDate);
      if (toDate) params.set('to', toDate);

      const res = await api(`/logs/search?${params}`);
      if (res.ok) {
        const data: LogPage = await res.json();
        setLogs(data.content ?? []);
        setTotalPages(data.totalPages ?? 0);
        setTotalElements(data.totalElements ?? 0);
        setPage(data.number ?? 0);
      }
    } catch (err) {
      console.error('Failed to search logs:', err);
    } finally {
      setLoading(false);
    }
  }, [companyId, token, query, fromDate, toDate]);

  useEffect(() => {
    fetchStats();
    fetchLogs(0);
  }, []);

  const handleSearch = () => {
    setPage(0);
    fetchLogs(0);
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    fetchLogs(newPage);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Log Explorer</h1>
          <p className="text-slate-400 text-sm mt-1">Search and analyze security logs across your environment</p>
        </div>
        <button
          onClick={() => { fetchStats(); fetchLogs(page); }}
          className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-slate-300 rounded-lg border border-slate-700 hover:bg-slate-700 transition"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Logs Today', value: statsLoading ? '—' : stats.totalToday.toLocaleString(), icon: <Database className="w-5 h-5 text-blue-400" />, color: 'text-blue-400' },
          { label: 'Active Sources', value: statsLoading ? '—' : stats.activeSources.toLocaleString(), icon: <Activity className="w-5 h-5 text-green-400" />, color: 'text-green-400' },
          { label: 'Events / sec', value: statsLoading ? '—' : stats.eventsPerSec.toFixed(1), icon: <Activity className="w-5 h-5 text-amber-400" />, color: 'text-amber-400' },
        ].map(stat => (
          <div key={stat.label} className="bg-slate-900 border border-slate-700 rounded-lg p-4 flex items-center gap-4">
            <div className="p-2 bg-slate-800 rounded-lg">{stat.icon}</div>
            <div>
              <p className="text-slate-400 text-xs">{stat.label}</p>
              <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Search Bar */}
      <div className="bg-slate-900 border border-slate-700 rounded-lg p-4">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder="Search logs by keyword, IP, category..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div className="flex gap-2 items-center">
            <div>
              <label className="block text-xs text-slate-500 mb-1">From</label>
              <input
                type="datetime-local"
                value={fromDate}
                onChange={e => setFromDate(e.target.value)}
                className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">To</label>
              <input
                type="datetime-local"
                value={toDate}
                onChange={e => setToDate(e.target.value)}
                className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div className="pt-5">
              <button
                onClick={handleSearch}
                disabled={loading}
                className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition font-medium"
              >
                <Search className="w-4 h-4" />
                {loading ? 'Searching...' : 'Search'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Results Table */}
      <div className="bg-slate-900 border border-slate-700 rounded-lg overflow-hidden">
        <div className="p-4 border-b border-slate-700 flex items-center justify-between">
          <h2 className="text-white font-semibold">
            Results{' '}
            <span className="text-slate-400 font-normal text-sm">
              ({totalElements.toLocaleString()} total)
            </span>
          </h2>
          {loading && <span className="text-slate-400 text-sm">Loading...</span>}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-slate-400 uppercase tracking-wider bg-slate-800/50">
                <th className="text-left px-4 py-3">Timestamp</th>
                <th className="text-left px-4 py-3">Source</th>
                <th className="text-left px-4 py-3">Severity</th>
                <th className="text-left px-4 py-3">Src IP</th>
                <th className="text-left px-4 py-3">Dst IP</th>
                <th className="text-left px-4 py-3">Action</th>
                <th className="text-left px-4 py-3">Category</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {logs.length === 0 && !loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-500">
                    No logs found. Try adjusting your search criteria.
                  </td>
                </tr>
              ) : (
                logs.map((log, i) => (
                  <tr key={log.id || i} className="hover:bg-slate-800/50 transition">
                    <td className="px-4 py-3 text-slate-300 whitespace-nowrap font-mono text-xs">
                      {log.timestamp ? new Date(log.timestamp).toLocaleString() : '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-300">{log.source || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${severityBadge(log.severity)}`}>
                        {log.severity || 'unknown'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-300 font-mono text-xs">{log.srcIp || '—'}</td>
                    <td className="px-4 py-3 text-slate-300 font-mono text-xs">{log.dstIp || '—'}</td>
                    <td className="px-4 py-3 text-slate-300">{log.action || '—'}</td>
                    <td className="px-4 py-3 text-slate-400">{log.category || '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-slate-700 flex items-center justify-between">
            <span className="text-slate-400 text-sm">
              Page {page + 1} of {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handlePageChange(page - 1)}
                disabled={page === 0}
                className="p-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
                let p2 = i;
                if (totalPages > 7) {
                  const start = Math.max(0, Math.min(page - 3, totalPages - 7));
                  p2 = start + i;
                }
                return (
                  <button
                    key={p2}
                    onClick={() => handlePageChange(p2)}
                    className={`w-8 h-8 rounded-lg text-sm transition ${
                      p2 === page
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {p2 + 1}
                  </button>
                );
              })}
              <button
                onClick={() => handlePageChange(page + 1)}
                disabled={page >= totalPages - 1}
                className="p-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LogExplorer;
