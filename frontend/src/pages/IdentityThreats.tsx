import React, { useEffect, useState, useCallback } from 'react';
import {
  ShieldAlert, User, CheckCircle, XCircle, ChevronLeft, ChevronRight,
  Search, Filter, RefreshCw, AlertTriangle, LogIn, Lock, Key
} from 'lucide-react';
import api from '../lib/api';

interface IdentityEvent {
  id: string;
  timestamp: string;
  eventType: string;
  username: string;
  sourceIp: string;
  success: boolean;
  riskScore: number;
  userAgent: string;
  details: string | null;
}

interface IdentityStats {
  totalEventsToday: number;
  failedLoginsToday: number;
  uniqueUsers: number;
  detectedThreats: number;
}

const EVENT_TYPES = [
  'login_success',
  'login_failure',
  'mfa_challenge',
  'password_change',
  'privilege_escalation',
  'account_lockout',
];

const eventTypeBadge = (type: string) => {
  const map: Record<string, string> = {
    login_success: 'bg-green-500/10 text-green-400 border border-green-500/20',
    login_failure: 'bg-red-500/10 text-red-400 border border-red-500/20',
    mfa_challenge: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
    password_change: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
    privilege_escalation: 'bg-purple-500/10 text-purple-400 border border-purple-500/20',
    account_lockout: 'bg-orange-500/10 text-orange-400 border border-orange-500/20',
  };
  return map[type] ?? 'bg-slate-700 text-slate-300';
};

const riskBadge = (score: number) => {
  if (score >= 75) return 'text-red-400 bg-red-500/10 border border-red-500/20';
  if (score >= 50) return 'text-orange-400 bg-orange-500/10 border border-orange-500/20';
  if (score >= 25) return 'text-amber-400 bg-amber-500/10 border border-amber-500/20';
  return 'text-green-400 bg-green-500/10 border border-green-500/20';
};

const fmt = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'medium' });

const toInputDate = (d: Date) => d.toISOString().slice(0, 16);

const IdentityThreats: React.FC = () => {
  const companyId = (JSON.parse(localStorage.getItem('user') || '{}') as { companyId?: string }).companyId;

  const [events, setEvents] = useState<IdentityEvent[]>([]);
  const [stats, setStats] = useState<IdentityStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);

  const now = new Date();
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);

  const [from, setFrom] = useState(toInputDate(dayStart));
  const [to, setTo] = useState(toInputDate(now));
  const [eventType, setEventType] = useState('');
  const [usernameFilter, setUsernameFilter] = useState('');
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const r = await api.get('/identity/stats', { params: { companyId } });
      setStats(r.data);
    } catch (e) {
      console.error('Failed to load identity stats', e);
    } finally {
      setStatsLoading(false);
    }
  }, [companyId]);

  const loadEvents = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = {
        companyId,
        from: new Date(from).toISOString(),
        to: new Date(to).toISOString(),
        page,
        size: 50,
      };
      if (eventType) params.eventType = eventType;
      if (selectedUser) params.username = selectedUser;
      else if (usernameFilter) params.username = usernameFilter;
      const r = await api.get('/identity/events', { params });
      const data = r.data;
      if (Array.isArray(data)) {
        setEvents(data);
        setTotalPages(1);
      } else {
        setEvents(data.content ?? data.events ?? []);
        setTotalPages(data.totalPages ?? 1);
      }
    } catch (e) {
      console.error('Failed to load identity events', e);
    } finally {
      setLoading(false);
    }
  }, [companyId, from, to, eventType, usernameFilter, selectedUser, page]);

  useEffect(() => { loadStats(); }, [loadStats]);
  useEffect(() => { loadEvents(); }, [loadEvents]);

  const handleUsernameClick = (username: string) => {
    setSelectedUser(prev => prev === username ? null : username);
    setPage(0);
  };

  const statCards = [
    { label: 'Total Events Today', value: stats?.totalEventsToday ?? 0, icon: <LogIn className="w-5 h-5 text-blue-400" />, color: 'text-blue-400' },
    { label: 'Failed Logins Today', value: stats?.failedLoginsToday ?? 0, icon: <XCircle className="w-5 h-5 text-red-400" />, color: 'text-red-400' },
    { label: 'Unique Users', value: stats?.uniqueUsers ?? 0, icon: <User className="w-5 h-5 text-slate-300" />, color: 'text-white' },
    { label: 'Detected Threats', value: stats?.detectedThreats ?? 0, icon: <AlertTriangle className="w-5 h-5 text-orange-400" />, color: 'text-orange-400' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <ShieldAlert className="w-7 h-7 text-blue-400" />
            Identity Threat Detection &amp; Response
          </h1>
          <p className="text-slate-400 text-sm mt-1">Monitor identity events, detect anomalies, and respond to threats</p>
        </div>
        <button
          onClick={() => { loadEvents(); loadStats(); }}
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
              {statsLoading ? '—' : card.value.toLocaleString()}
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-slate-900 border border-slate-700 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-3 text-slate-300 text-sm font-medium">
          <Filter className="w-4 h-4" />
          Filters
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Event Type</label>
            <select
              value={eventType}
              onChange={e => { setEventType(e.target.value); setPage(0); }}
              className="w-full bg-slate-800 border border-slate-600 rounded-md px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
            >
              <option value="">All Types</option>
              {EVENT_TYPES.map(t => (
                <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">From</label>
            <input
              type="datetime-local"
              value={from}
              onChange={e => { setFrom(e.target.value); setPage(0); }}
              className="w-full bg-slate-800 border border-slate-600 rounded-md px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">To</label>
            <input
              type="datetime-local"
              value={to}
              onChange={e => { setTo(e.target.value); setPage(0); }}
              className="w-full bg-slate-800 border border-slate-600 rounded-md px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Username Search</label>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                placeholder="Search username..."
                value={usernameFilter}
                onChange={e => { setUsernameFilter(e.target.value); setSelectedUser(null); setPage(0); }}
                className="w-full bg-slate-800 border border-slate-600 rounded-md pl-8 pr-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>
        </div>
        {selectedUser && (
          <div className="mt-3 flex items-center gap-2">
            <span className="text-xs text-slate-400">Filtered by user:</span>
            <span className="px-2 py-0.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded text-xs">{selectedUser}</span>
            <button onClick={() => setSelectedUser(null)} className="text-xs text-slate-500 hover:text-slate-300">Clear</button>
          </div>
        )}
      </div>

      {/* Events Table */}
      <div className="bg-slate-900 border border-slate-700 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
            <Key className="w-4 h-4 text-slate-400" />
            Identity Events
          </h2>
          <span className="text-xs text-slate-500">{events.length} records</span>
        </div>
        {loading ? (
          <div className="flex items-center justify-center h-40 text-slate-400 text-sm">Loading events...</div>
        ) : events.length === 0 ? (
          <div className="flex items-center justify-center h-40 text-slate-500 text-sm">No events found for this period.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-slate-400 border-b border-slate-700">
                  <th className="px-4 py-3 text-left font-medium">Timestamp</th>
                  <th className="px-4 py-3 text-left font-medium">Event Type</th>
                  <th className="px-4 py-3 text-left font-medium">Username</th>
                  <th className="px-4 py-3 text-left font-medium">Source IP</th>
                  <th className="px-4 py-3 text-left font-medium">Result</th>
                  <th className="px-4 py-3 text-left font-medium">Risk Score</th>
                  <th className="px-4 py-3 text-left font-medium max-w-xs">User Agent</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {events.map(ev => (
                  <tr key={ev.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-4 py-3 text-slate-400 whitespace-nowrap font-mono text-xs">{fmt(ev.timestamp)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${eventTypeBadge(ev.eventType)}`}>
                        {ev.eventType.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleUsernameClick(ev.username)}
                        className="text-blue-400 hover:text-blue-300 hover:underline font-mono text-xs"
                      >
                        {ev.username}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-slate-300 font-mono text-xs">{ev.sourceIp}</td>
                    <td className="px-4 py-3">
                      {ev.success
                        ? <CheckCircle className="w-4 h-4 text-green-400" />
                        : <XCircle className="w-4 h-4 text-red-400" />}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${riskBadge(ev.riskScore)}`}>
                        {ev.riskScore}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs truncate max-w-xs" title={ev.userAgent}>
                      {ev.userAgent}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
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
      </div>

      {/* User Activity Note */}
      <div className="bg-slate-900/50 border border-slate-700/50 rounded-lg px-4 py-3 text-xs text-slate-500 flex items-center gap-2">
        <Lock className="w-4 h-4 flex-shrink-0" />
        Click any username in the table to filter events for that user. Risk scores above 75 indicate potential threats requiring immediate investigation.
      </div>
    </div>
  );
};

export default IdentityThreats;
