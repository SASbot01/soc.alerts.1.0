import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { Plus, Globe, ChevronDown, ChevronUp, X, RefreshCw, AlertTriangle, Eye } from 'lucide-react';

interface Domain {
  id: string;
  domain: string;
  discoveredAt: string;
  subdomainsCount: number;
  openPortsCount: number;
  riskScore: number;
  lastScan: string | null;
}

interface Discovery {
  id: string;
  type: string;
  value: string;
  riskLevel: string;
  firstSeen: string;
  lastSeen: string;
}

interface AsmStats {
  totalDomains: number;
  totalDiscoveries: number;
  highRiskFindings: number;
}

const riskBg = (score: number) => {
  if (score >= 8) return 'bg-red-500/20 text-red-400 border border-red-500/30';
  if (score >= 5) return 'bg-amber-500/20 text-amber-400 border border-amber-500/30';
  if (score >= 3) return 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30';
  return 'bg-green-500/20 text-green-400 border border-green-500/30';
};

const riskLevelBadge = (level: string) => {
  const l = level?.toLowerCase();
  if (l === 'critical' || l === 'high') return 'bg-red-500/20 text-red-400';
  if (l === 'medium') return 'bg-amber-500/20 text-amber-400';
  return 'bg-green-500/20 text-green-400';
};

const inputCls = 'w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:border-blue-500 focus:outline-none placeholder-slate-500';

const AttackSurface: React.FC = () => {
  const { user } = useAuth();
  const companyId = user?.companyId;
  const token = localStorage.getItem('token');

  const [domains, setDomains] = useState<Domain[]>([]);
  const [stats, setStats] = useState<AsmStats>({ totalDomains: 0, totalDiscoveries: 0, highRiskFindings: 0 });
  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [domainInput, setDomainInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [expandedDomain, setExpandedDomain] = useState<string | null>(null);
  const [discoveries, setDiscoveries] = useState<Record<string, Discovery[]>>({});
  const [loadingDiscoveries, setLoadingDiscoveries] = useState<string | null>(null);

  const api = (path: string, opts?: RequestInit) =>
    fetch(`/api/v1${path}`, {
      ...opts,
      headers: { ...opts?.headers, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    });

  const fetchAll = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const [domainsRes, statsRes] = await Promise.all([
        api(`/asm/domains?companyId=${companyId}`),
        api(`/asm/stats?companyId=${companyId}`),
      ]);
      if (domainsRes.ok) setDomains(await domainsRes.json());
      if (statsRes.ok) setStats(await statsRes.json());
    } catch (err) {
      console.error('Failed to load ASM data:', err);
    } finally {
      setLoading(false);
    }
  }, [companyId, token]);

  useEffect(() => { fetchAll(); }, []);

  const addDomain = async () => {
    if (!domainInput.trim() || !companyId) return;
    setSaving(true);
    try {
      const res = await api('/asm/domains', {
        method: 'POST',
        body: JSON.stringify({ domain: domainInput.trim(), companyId }),
      });
      if (res.ok) {
        setDomainInput('');
        setShowAddForm(false);
        fetchAll();
      }
    } catch (err) {
      console.error('Failed to add domain:', err);
    } finally {
      setSaving(false);
    }
  };

  const toggleDomain = async (domainId: string) => {
    if (expandedDomain === domainId) {
      setExpandedDomain(null);
      return;
    }
    setExpandedDomain(domainId);
    if (!discoveries[domainId]) {
      setLoadingDiscoveries(domainId);
      try {
        const res = await api(`/asm/domains/${domainId}/discoveries`);
        if (res.ok) {
          const data = await res.json();
          setDiscoveries(prev => ({ ...prev, [domainId]: data }));
        }
      } catch (err) {
        console.error('Failed to load discoveries:', err);
      } finally {
        setLoadingDiscoveries(null);
      }
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Attack Surface Management</h1>
          <p className="text-slate-400 text-sm mt-1">Monitor and reduce your external attack surface</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm"
          >
            <Plus className="w-4 h-4" />
            Add Domain
          </button>
          <button
            onClick={fetchAll}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-slate-300 rounded-lg border border-slate-700 hover:bg-slate-700 transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Domains', value: stats.totalDomains, icon: <Globe className="w-5 h-5 text-blue-400" />, color: 'text-blue-400' },
          { label: 'Total Discoveries', value: stats.totalDiscoveries, icon: <Eye className="w-5 h-5 text-purple-400" />, color: 'text-purple-400' },
          { label: 'High-Risk Findings', value: stats.highRiskFindings, icon: <AlertTriangle className="w-5 h-5 text-red-400" />, color: 'text-red-400' },
        ].map(s => (
          <div key={s.label} className="bg-slate-900 border border-slate-700 rounded-lg p-4 flex items-center gap-4">
            <div className="p-2 bg-slate-800 rounded-lg">{s.icon}</div>
            <div>
              <p className="text-slate-400 text-xs">{s.label}</p>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value.toLocaleString()}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Add Domain Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-slate-900 border border-slate-700 rounded-lg p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-semibold">Add Domain</h3>
              <button onClick={() => setShowAddForm(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Domain Name</label>
              <input
                type="text"
                value={domainInput}
                onChange={e => setDomainInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addDomain()}
                placeholder="e.g. example.com"
                className={inputCls}
                autoFocus
              />
              <p className="text-slate-500 text-xs mt-1">The system will automatically discover subdomains and open ports.</p>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setShowAddForm(false)} className="px-4 py-2 text-slate-400 hover:text-white transition text-sm">Cancel</button>
              <button
                onClick={addDomain}
                disabled={saving || !domainInput.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition text-sm"
              >
                {saving ? 'Adding...' : 'Add Domain'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Domains Table */}
      <div className="bg-slate-900 border border-slate-700 rounded-lg overflow-hidden">
        <div className="p-4 border-b border-slate-700">
          <h2 className="text-white font-semibold">Monitored Domains</h2>
        </div>
        {domains.length === 0 ? (
          <div className="py-12 text-center text-slate-500">
            No domains monitored. Add your first domain to start attack surface analysis.
          </div>
        ) : (
          <div>
            {domains.map(domain => (
              <div key={domain.id} className="border-b border-slate-700 last:border-0">
                <div
                  className="flex items-center gap-4 px-4 py-4 hover:bg-slate-800/40 transition cursor-pointer"
                  onClick={() => toggleDomain(domain.id)}
                >
                  <Globe className="w-5 h-5 text-blue-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium">{domain.domain}</p>
                    <p className="text-slate-400 text-xs mt-0.5">
                      Discovered {domain.discoveredAt ? new Date(domain.discoveredAt).toLocaleDateString() : '—'}
                      {domain.lastScan && ` · Last scan ${new Date(domain.lastScan).toLocaleDateString()}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-6 text-sm">
                    <div className="text-center">
                      <p className="text-slate-400 text-xs">Subdomains</p>
                      <p className="text-white font-medium">{domain.subdomainsCount ?? 0}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-slate-400 text-xs">Open Ports</p>
                      <p className="text-white font-medium">{domain.openPortsCount ?? 0}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-slate-400 text-xs">Risk Score</p>
                      <span className={`px-2.5 py-0.5 rounded text-xs font-bold ${riskBg(domain.riskScore ?? 0)}`}>
                        {domain.riskScore ?? 0}/10
                      </span>
                    </div>
                    {expandedDomain === domain.id
                      ? <ChevronUp className="w-5 h-5 text-slate-400" />
                      : <ChevronDown className="w-5 h-5 text-slate-400" />}
                  </div>
                </div>

                {expandedDomain === domain.id && (
                  <div className="px-4 pb-4 bg-slate-800/20">
                    <h4 className="text-slate-300 text-sm font-medium mb-3">Discoveries</h4>
                    {loadingDiscoveries === domain.id ? (
                      <p className="text-slate-400 text-sm py-4">Loading discoveries...</p>
                    ) : (discoveries[domain.id] ?? []).length === 0 ? (
                      <p className="text-slate-500 text-sm py-4">No discoveries found for this domain yet.</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-xs text-slate-400 uppercase tracking-wider">
                              <th className="text-left py-2 pr-4">Type</th>
                              <th className="text-left py-2 pr-4">Value</th>
                              <th className="text-left py-2 pr-4">Risk Level</th>
                              <th className="text-left py-2 pr-4">First Seen</th>
                              <th className="text-left py-2">Last Seen</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-700/50">
                            {(discoveries[domain.id] ?? []).map(d => (
                              <tr key={d.id} className="hover:bg-slate-800/30 transition">
                                <td className="py-2 pr-4">
                                  <span className="px-2 py-0.5 bg-slate-700 text-slate-300 rounded text-xs uppercase">{d.type}</span>
                                </td>
                                <td className="py-2 pr-4 text-slate-300 font-mono text-xs max-w-xs truncate">{d.value}</td>
                                <td className="py-2 pr-4">
                                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${riskLevelBadge(d.riskLevel)}`}>
                                    {d.riskLevel}
                                  </span>
                                </td>
                                <td className="py-2 pr-4 text-slate-400 text-xs whitespace-nowrap">
                                  {d.firstSeen ? new Date(d.firstSeen).toLocaleDateString() : '—'}
                                </td>
                                <td className="py-2 text-slate-400 text-xs whitespace-nowrap">
                                  {d.lastSeen ? new Date(d.lastSeen).toLocaleDateString() : '—'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
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

export default AttackSurface;
