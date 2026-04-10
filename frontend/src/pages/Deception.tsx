import React, { useEffect, useState, useCallback } from 'react';
import {
  Eye, Plus, Power, ChevronDown, ChevronRight, RefreshCw,
  AlertTriangle, Shield, Clock, X
} from 'lucide-react';
import api from '../lib/api';

interface HoneyToken {
  id: string;
  name: string;
  tokenType: string;
  value: string;
  description: string | null;
  isActive: boolean;
  hitCount: number;
  deployedAt: string;
  lastHitAt: string | null;
}

interface TokenEvent {
  id: string;
  tokenId: string;
  timestamp: string;
  sourceIp: string;
  userAgent: string;
  details: string | null;
}

interface DeceptionStats {
  activeTokens: number;
  totalHits: number;
  hitsLast24h: number;
}

const TOKEN_TYPES = ['credential', 'file', 'url', 'dns'];

const typeBadge = (type: string) => {
  const map: Record<string, string> = {
    credential: 'bg-red-500/10 text-red-400 border-red-500/20',
    file: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    url: 'bg-green-500/10 text-green-400 border-green-500/20',
    dns: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  };
  return `border ${map[type] ?? 'bg-slate-700/50 text-slate-300 border-slate-600'}`;
};

const maskValue = (value: string, type: string) => {
  if (type === 'credential') {
    const parts = value.split(':');
    if (parts.length >= 2) return `${parts[0]}:${'*'.repeat(Math.min(8, parts[1].length))}`;
    return value.slice(0, 4) + '*'.repeat(Math.max(0, value.length - 4));
  }
  if (value.length > 20) return value.slice(0, 10) + '...' + value.slice(-6);
  return value;
};

const fmt = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'medium' });

const Deception: React.FC = () => {
  const companyId = (JSON.parse(localStorage.getItem('user') || '{}') as { companyId?: string }).companyId;

  const [tokens, setTokens] = useState<HoneyToken[]>([]);
  const [stats, setStats] = useState<DeceptionStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedToken, setExpandedToken] = useState<string | null>(null);
  const [tokenEvents, setTokenEvents] = useState<Record<string, TokenEvent[]>>({});
  const [eventsLoading, setEventsLoading] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [confirmDeactivate, setConfirmDeactivate] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const [newToken, setNewToken] = useState({
    name: '',
    tokenType: 'credential',
    value: '',
    description: '',
  });
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [tr, sr] = await Promise.all([
        api.get('/deception/tokens', { params: { companyId } }),
        api.get('/deception/stats', { params: { companyId } }),
      ]);
      setTokens(Array.isArray(tr.data) ? tr.data : tr.data.tokens ?? []);
      setStats(sr.data);
    } catch (e) {
      console.error('Failed to load deception data', e);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => { loadData(); }, [loadData]);

  const toggleExpand = async (id: string) => {
    if (expandedToken === id) {
      setExpandedToken(null);
      return;
    }
    setExpandedToken(id);
    if (tokenEvents[id]) return;
    setEventsLoading(id);
    try {
      const r = await api.get(`/deception/tokens/${id}/events`);
      setTokenEvents(prev => ({ ...prev, [id]: Array.isArray(r.data) ? r.data : r.data.events ?? [] }));
    } catch (e) {
      console.error('Failed to load token events', e);
    } finally {
      setEventsLoading(null);
    }
  };

  const handleDeactivate = async (id: string) => {
    setActionLoading(id);
    try {
      await api.post(`/deception/tokens/${id}/deactivate`);
      await loadData();
      setConfirmDeactivate(null);
    } catch (e) {
      console.error('Failed to deactivate token', e);
    } finally {
      setActionLoading(null);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError('');
    if (!newToken.name.trim() || !newToken.value.trim()) {
      setCreateError('Name and value are required.');
      return;
    }
    setCreateLoading(true);
    try {
      await api.post('/deception/tokens', { ...newToken, companyId });
      setNewToken({ name: '', tokenType: 'credential', value: '', description: '' });
      setShowCreateForm(false);
      await loadData();
    } catch (e) {
      setCreateError('Failed to create token. Please try again.');
      console.error(e);
    } finally {
      setCreateLoading(false);
    }
  };

  const statCards = [
    { label: 'Active Tokens', value: stats?.activeTokens ?? 0, icon: <Shield className="w-5 h-5 text-blue-400" />, color: 'text-blue-400' },
    { label: 'Total Hits', value: stats?.totalHits ?? 0, icon: <AlertTriangle className="w-5 h-5 text-red-400" />, color: 'text-red-400' },
    { label: 'Hits Last 24h', value: stats?.hitsLast24h ?? 0, icon: <Clock className="w-5 h-5 text-orange-400" />, color: 'text-orange-400' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Eye className="w-7 h-7 text-amber-400" />
            Deception Technology
          </h1>
          <p className="text-slate-400 text-sm mt-1">Honeypots and honey tokens to detect intruders early</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            className="flex items-center gap-2 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-300 hover:text-white hover:border-slate-500 transition-colors text-sm"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          <button
            onClick={() => setShowCreateForm(v => !v)}
            className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-white transition-colors text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            New Token
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {statCards.map(card => (
          <div key={card.label} className="bg-slate-900 border border-slate-700 rounded-lg p-4">
            <div className="flex items-center gap-2 text-slate-400 text-sm mb-2">
              {card.icon}
              {card.label}
            </div>
            <div className={`text-3xl font-bold ${card.color}`}>
              {loading ? '—' : card.value.toLocaleString()}
            </div>
          </div>
        ))}
      </div>

      {/* Create Token Form */}
      {showCreateForm && (
        <div className="bg-slate-900 border border-blue-500/30 rounded-lg p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <Plus className="w-4 h-4 text-blue-400" />
              Create Honey Token
            </h2>
            <button onClick={() => setShowCreateForm(false)} className="text-slate-500 hover:text-slate-300">
              <X className="w-4 h-4" />
            </button>
          </div>
          <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Name <span className="text-red-400">*</span></label>
              <input
                type="text"
                placeholder="e.g. Admin Portal Credentials"
                value={newToken.name}
                onChange={e => setNewToken(p => ({ ...p, name: e.target.value }))}
                className="w-full bg-slate-800 border border-slate-600 rounded-md px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Token Type</label>
              <select
                value={newToken.tokenType}
                onChange={e => setNewToken(p => ({ ...p, tokenType: e.target.value }))}
                className="w-full bg-slate-800 border border-slate-600 rounded-md px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
              >
                {TOKEN_TYPES.map(t => (
                  <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Value <span className="text-red-400">*</span></label>
              <input
                type="text"
                placeholder="e.g. admin:password123 or http://..."
                value={newToken.value}
                onChange={e => setNewToken(p => ({ ...p, value: e.target.value }))}
                className="w-full bg-slate-800 border border-slate-600 rounded-md px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Description</label>
              <input
                type="text"
                placeholder="Optional description..."
                value={newToken.description}
                onChange={e => setNewToken(p => ({ ...p, description: e.target.value }))}
                className="w-full bg-slate-800 border border-slate-600 rounded-md px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>
            {createError && (
              <div className="sm:col-span-2 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded px-3 py-2">
                {createError}
              </div>
            )}
            <div className="sm:col-span-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-300 text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createLoading}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-white text-sm font-medium transition-colors disabled:opacity-50"
              >
                {createLoading ? 'Creating...' : 'Create Token'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tokens Table */}
      <div className="bg-slate-900 border border-slate-700 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-700">
          <h2 className="text-sm font-semibold text-slate-200">Honey Tokens</h2>
        </div>
        {loading ? (
          <div className="flex items-center justify-center h-40 text-slate-400 text-sm">Loading tokens...</div>
        ) : tokens.length === 0 ? (
          <div className="flex items-center justify-center h-40 text-slate-500 text-sm">No tokens deployed yet.</div>
        ) : (
          <div className="divide-y divide-slate-700/50">
            {tokens.map(token => (
              <div key={token.id}>
                <div className="flex items-center gap-3 px-4 py-3 hover:bg-slate-800/30 transition-colors">
                  {/* Expand toggle */}
                  <button onClick={() => toggleExpand(token.id)} className="text-slate-500 hover:text-slate-300 flex-shrink-0">
                    {expandedToken === token.id
                      ? <ChevronDown className="w-4 h-4" />
                      : <ChevronRight className="w-4 h-4" />}
                  </button>

                  {/* Name */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-slate-200">{token.name}</span>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${typeBadge(token.tokenType)}`}>
                        {token.tokenType}
                      </span>
                      {!token.isActive && (
                        <span className="px-2 py-0.5 rounded text-xs bg-slate-700 text-slate-400 border border-slate-600">inactive</span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 font-mono mt-0.5">{maskValue(token.value, token.tokenType)}</div>
                  </div>

                  {/* Deployed */}
                  <div className="hidden lg:block text-xs text-slate-400 flex-shrink-0">
                    Deployed {fmt(token.deployedAt)}
                  </div>

                  {/* Hit count */}
                  <div className="flex-shrink-0">
                    <span className={`px-2 py-1 rounded text-sm font-bold ${token.hitCount > 0 ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-slate-800 text-slate-400 border border-slate-700'}`}>
                      {token.hitCount} hit{token.hitCount !== 1 ? 's' : ''}
                    </span>
                  </div>

                  {/* Active indicator */}
                  <div className="flex-shrink-0">
                    <span className={`w-2 h-2 rounded-full inline-block ${token.isActive ? 'bg-green-400' : 'bg-slate-600'}`} />
                  </div>

                  {/* Deactivate */}
                  {token.isActive && (
                    <div className="flex-shrink-0">
                      {confirmDeactivate === token.id ? (
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-slate-400">Confirm?</span>
                          <button
                            onClick={() => handleDeactivate(token.id)}
                            disabled={actionLoading === token.id}
                            className="px-2 py-1 bg-red-600 hover:bg-red-500 rounded text-white text-xs disabled:opacity-50"
                          >
                            {actionLoading === token.id ? '...' : 'Yes'}
                          </button>
                          <button
                            onClick={() => setConfirmDeactivate(null)}
                            className="px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded text-slate-300 text-xs"
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmDeactivate(token.id)}
                          className="flex items-center gap-1 px-2 py-1 bg-slate-800 border border-slate-700 hover:border-red-500/50 rounded text-slate-400 hover:text-red-400 text-xs transition-colors"
                        >
                          <Power className="w-3 h-3" />
                          Deactivate
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Expanded Events */}
                {expandedToken === token.id && (
                  <div className="bg-slate-950/50 border-t border-slate-700/50 px-8 py-4">
                    <h3 className="text-xs font-semibold text-slate-300 mb-3 flex items-center gap-2">
                      <AlertTriangle className="w-3 h-3 text-amber-400" />
                      Token Events
                      {token.description && (
                        <span className="ml-2 text-slate-500 font-normal">&mdash; {token.description}</span>
                      )}
                    </h3>
                    {eventsLoading === token.id ? (
                      <div className="text-slate-400 text-sm py-4">Loading events...</div>
                    ) : !tokenEvents[token.id] || tokenEvents[token.id].length === 0 ? (
                      <div className="text-slate-500 text-sm py-4">No events recorded for this token.</div>
                    ) : (
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-slate-500 border-b border-slate-700">
                            <th className="py-2 pr-4 text-left font-medium">Timestamp</th>
                            <th className="py-2 pr-4 text-left font-medium">Source IP</th>
                            <th className="py-2 pr-4 text-left font-medium">User Agent</th>
                            <th className="py-2 text-left font-medium">Details</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700/30">
                          {tokenEvents[token.id].map(ev => (
                            <tr key={ev.id} className="hover:bg-slate-800/20">
                              <td className="py-2 pr-4 font-mono text-slate-400 whitespace-nowrap">{fmt(ev.timestamp)}</td>
                              <td className="py-2 pr-4 font-mono text-red-400">{ev.sourceIp}</td>
                              <td className="py-2 pr-4 text-slate-400 max-w-xs truncate" title={ev.userAgent}>{ev.userAgent}</td>
                              <td className="py-2 text-slate-400">{ev.details ?? '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Deception;
