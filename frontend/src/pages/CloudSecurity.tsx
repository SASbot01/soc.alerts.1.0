import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { Plus, Trash2, X, ChevronDown, ChevronUp, RefreshCw, Cloud, AlertTriangle, CheckCircle, Shield } from 'lucide-react';

interface CloudAccount {
  id: string;
  provider: 'AWS' | 'Azure' | 'GCP';
  accountId: string;
  alias: string;
  findingsCount: number;
  lastScan: string | null;
  enabled: boolean;
}

interface CloudFinding {
  id: string;
  ruleId: string;
  resourceType: string;
  severity: string;
  title: string;
  status: 'open' | 'resolved';
  detectedAt: string;
}

interface CloudStats {
  totalAccounts: number;
  totalFindings: number;
  criticalFindings: number;
  resolvedPercent: number;
}

const providerColor: Record<string, string> = {
  AWS: 'bg-amber-500/20 text-amber-400',
  Azure: 'bg-blue-500/20 text-blue-400',
  GCP: 'bg-green-500/20 text-green-400',
};

const providerIcon: Record<string, string> = {
  AWS: '🟠',
  Azure: '🔵',
  GCP: '🟢',
};

const severityBadge = (s: string) => {
  const v = s?.toLowerCase();
  if (v === 'critical') return 'bg-red-600 text-white';
  if (v === 'high') return 'bg-red-500/20 text-red-400 border border-red-500/40';
  if (v === 'medium') return 'bg-amber-500/20 text-amber-400 border border-amber-500/40';
  if (v === 'low') return 'bg-blue-500/20 text-blue-400 border border-blue-500/40';
  return 'bg-slate-700 text-slate-300';
};

const inputCls = 'w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:border-blue-500 focus:outline-none placeholder-slate-500';
const labelCls = 'block text-xs text-slate-400 mb-1';

const CloudSecurity: React.FC = () => {
  const { user } = useAuth();
  const companyId = user?.companyId;
  const token = localStorage.getItem('token');

  const [accounts, setAccounts] = useState<CloudAccount[]>([]);
  const [stats, setStats] = useState<CloudStats>({ totalAccounts: 0, totalFindings: 0, criticalFindings: 0, resolvedPercent: 0 });
  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [accountForm, setAccountForm] = useState({ provider: 'AWS', accountId: '', alias: '' });
  const [saving, setSaving] = useState(false);

  const [expandedAccount, setExpandedAccount] = useState<string | null>(null);
  const [findings, setFindings] = useState<Record<string, CloudFinding[]>>({});
  const [loadingFindings, setLoadingFindings] = useState<string | null>(null);
  const [resolvingFinding, setResolvingFinding] = useState<string | null>(null);

  const api = (path: string, opts?: RequestInit) =>
    fetch(`/api/v1${path}`, {
      ...opts,
      headers: { ...opts?.headers, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    });

  const fetchAll = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const [accountsRes, statsRes] = await Promise.all([
        api(`/cloud-security/accounts?companyId=${companyId}`),
        api(`/cloud-security/stats?companyId=${companyId}`),
      ]);
      if (accountsRes.ok) setAccounts(await accountsRes.json());
      if (statsRes.ok) setStats(await statsRes.json());
    } catch (err) {
      console.error('Failed to load cloud security data:', err);
    } finally {
      setLoading(false);
    }
  }, [companyId, token]);

  useEffect(() => { fetchAll(); }, []);

  const addAccount = async () => {
    if (!accountForm.accountId.trim() || !companyId) return;
    setSaving(true);
    try {
      const res = await api('/cloud-security/accounts', {
        method: 'POST',
        body: JSON.stringify({ ...accountForm, companyId }),
      });
      if (res.ok) {
        setShowAddForm(false);
        setAccountForm({ provider: 'AWS', accountId: '', alias: '' });
        fetchAll();
      }
    } catch (err) {
      console.error('Failed to add account:', err);
    } finally {
      setSaving(false);
    }
  };

  const deleteAccount = async (id: string) => {
    try {
      await api(`/cloud-security/accounts/${id}`, { method: 'DELETE' });
      fetchAll();
    } catch (err) {
      console.error('Failed to delete account:', err);
    }
  };

  const toggleAccount = async (accountId: string) => {
    if (expandedAccount === accountId) {
      setExpandedAccount(null);
      return;
    }
    setExpandedAccount(accountId);
    if (!findings[accountId]) {
      setLoadingFindings(accountId);
      try {
        const res = await api(`/cloud-security/accounts/${accountId}/findings`);
        if (res.ok) {
          const data = await res.json();
          setFindings(prev => ({ ...prev, [accountId]: data }));
        }
      } catch (err) {
        console.error('Failed to load findings:', err);
      } finally {
        setLoadingFindings(null);
      }
    }
  };

  const resolveFinding = async (findingId: string, accountId: string) => {
    setResolvingFinding(findingId);
    try {
      const res = await api(`/cloud-security/findings/${findingId}/resolve`, { method: 'POST' });
      if (res.ok) {
        setFindings(prev => ({
          ...prev,
          [accountId]: (prev[accountId] ?? []).map(f =>
            f.id === findingId ? { ...f, status: 'resolved' } : f
          ),
        }));
        fetchAll();
      }
    } catch (err) {
      console.error('Failed to resolve finding:', err);
    } finally {
      setResolvingFinding(null);
    }
  };

  const openFindings = (accountId: string) => (findings[accountId] ?? []).filter(f => f.status === 'open');
  const resolvedFindings = (accountId: string) => (findings[accountId] ?? []).filter(f => f.status === 'resolved');

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Cloud Security</h1>
          <p className="text-slate-400 text-sm mt-1">Cloud Security Posture Management across AWS, Azure, and GCP</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm"
          >
            <Plus className="w-4 h-4" />
            Add Account
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
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Accounts', value: stats.totalAccounts, icon: <Cloud className="w-5 h-5 text-blue-400" />, color: 'text-blue-400' },
          { label: 'Total Findings', value: stats.totalFindings, icon: <AlertTriangle className="w-5 h-5 text-amber-400" />, color: 'text-amber-400' },
          { label: 'Critical Findings', value: stats.criticalFindings, icon: <AlertTriangle className="w-5 h-5 text-red-400" />, color: 'text-red-400' },
          { label: 'Resolved %', value: `${(stats.resolvedPercent ?? 0).toFixed(1)}%`, icon: <CheckCircle className="w-5 h-5 text-green-400" />, color: 'text-green-400' },
        ].map(s => (
          <div key={s.label} className="bg-slate-900 border border-slate-700 rounded-lg p-4 flex items-center gap-3">
            <div className="p-2 bg-slate-800 rounded-lg">{s.icon}</div>
            <div>
              <p className="text-slate-400 text-xs">{s.label}</p>
              <p className={`text-xl font-bold ${s.color}`}>{typeof s.value === 'number' ? s.value.toLocaleString() : s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Add Account Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-slate-900 border border-slate-700 rounded-lg p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-semibold">Add Cloud Account</h3>
              <button onClick={() => setShowAddForm(false)} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className={labelCls}>Cloud Provider</label>
                <select value={accountForm.provider} onChange={e => setAccountForm({ ...accountForm, provider: e.target.value })} className={inputCls}>
                  <option value="AWS">AWS — Amazon Web Services</option>
                  <option value="Azure">Azure — Microsoft Azure</option>
                  <option value="GCP">GCP — Google Cloud Platform</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Account ID</label>
                <input type="text" value={accountForm.accountId} onChange={e => setAccountForm({ ...accountForm, accountId: e.target.value })} placeholder="e.g. 123456789012" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Alias (optional)</label>
                <input type="text" value={accountForm.alias} onChange={e => setAccountForm({ ...accountForm, alias: e.target.value })} placeholder="Friendly name" className={inputCls} />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setShowAddForm(false)} className="px-4 py-2 text-slate-400 hover:text-white transition text-sm">Cancel</button>
              <button onClick={addAccount} disabled={saving || !accountForm.accountId.trim()} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition text-sm">
                {saving ? 'Adding...' : 'Add Account'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Accounts */}
      <div className="space-y-3">
        {accounts.length === 0 ? (
          <div className="bg-slate-900 border border-slate-700 rounded-lg p-12 text-center text-slate-500">
            No cloud accounts connected. Add your first account to start monitoring.
          </div>
        ) : (
          accounts.map(account => (
            <div key={account.id} className="bg-slate-900 border border-slate-700 rounded-lg overflow-hidden">
              {/* Account Header */}
              <div
                className="flex items-center gap-4 p-4 cursor-pointer hover:bg-slate-800/40 transition"
                onClick={() => toggleAccount(account.id)}
              >
                <div className={`px-2.5 py-1 rounded-lg text-xs font-bold ${providerColor[account.provider] ?? 'bg-slate-700 text-slate-300'}`}>
                  {providerIcon[account.provider]} {account.provider}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-white font-medium">{account.alias || account.accountId}</h3>
                    {account.alias && <span className="text-slate-500 text-xs font-mono">{account.accountId}</span>}
                  </div>
                  <p className="text-slate-400 text-xs mt-0.5">
                    Last scan: {account.lastScan ? new Date(account.lastScan).toLocaleString() : 'Never'}
                  </p>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-center">
                    <p className="text-slate-400 text-xs">Findings</p>
                    <p className={`font-bold ${account.findingsCount > 0 ? 'text-amber-400' : 'text-green-400'}`}>
                      {account.findingsCount}
                    </p>
                  </div>
                  <span className={`px-2.5 py-0.5 rounded text-xs font-medium ${account.enabled ? 'bg-green-500/20 text-green-400' : 'bg-slate-700 text-slate-400'}`}>
                    {account.enabled ? 'Active' : 'Disabled'}
                  </span>
                  <button
                    onClick={e => { e.stopPropagation(); deleteAccount(account.id); }}
                    className="p-1.5 text-red-400 hover:bg-red-500/10 rounded transition"
                    title="Remove account"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  {expandedAccount === account.id
                    ? <ChevronUp className="w-5 h-5 text-slate-400" />
                    : <ChevronDown className="w-5 h-5 text-slate-400" />}
                </div>
              </div>

              {/* Findings Panel */}
              {expandedAccount === account.id && (
                <div className="border-t border-slate-700 p-4">
                  {loadingFindings === account.id ? (
                    <p className="text-slate-400 text-sm text-center py-4">Loading findings...</p>
                  ) : (findings[account.id] ?? []).length === 0 ? (
                    <div className="text-center py-8">
                      <Shield className="w-8 h-8 text-green-400 mx-auto mb-2" />
                      <p className="text-green-400 font-medium text-sm">No findings detected</p>
                      <p className="text-slate-500 text-xs mt-1">This account has a clean security posture.</p>
                    </div>
                  ) : (
                    <>
                      {openFindings(account.id).length > 0 && (
                        <div className="mb-4">
                          <h4 className="text-white text-sm font-medium mb-2">
                            Open Findings ({openFindings(account.id).length})
                          </h4>
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="text-xs text-slate-400 uppercase tracking-wider">
                                  <th className="text-left py-2 pr-4">Rule ID</th>
                                  <th className="text-left py-2 pr-4">Resource</th>
                                  <th className="text-left py-2 pr-4">Severity</th>
                                  <th className="text-left py-2 pr-4">Title</th>
                                  <th className="text-left py-2 pr-4">Detected</th>
                                  <th className="text-left py-2">Action</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-700/50">
                                {openFindings(account.id).map(finding => (
                                  <tr key={finding.id} className="hover:bg-slate-800/30 transition">
                                    <td className="py-2 pr-4 text-slate-400 font-mono text-xs">{finding.ruleId}</td>
                                    <td className="py-2 pr-4 text-slate-300 text-xs">{finding.resourceType}</td>
                                    <td className="py-2 pr-4">
                                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${severityBadge(finding.severity)}`}>
                                        {finding.severity}
                                      </span>
                                    </td>
                                    <td className="py-2 pr-4 text-slate-300 max-w-xs truncate">{finding.title}</td>
                                    <td className="py-2 pr-4 text-slate-400 text-xs whitespace-nowrap">
                                      {finding.detectedAt ? new Date(finding.detectedAt).toLocaleDateString() : '—'}
                                    </td>
                                    <td className="py-2">
                                      <button
                                        onClick={() => resolveFinding(finding.id, account.id)}
                                        disabled={resolvingFinding === finding.id}
                                        className="flex items-center gap-1 px-2.5 py-1 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 transition text-xs"
                                      >
                                        <CheckCircle className="w-3.5 h-3.5" />
                                        {resolvingFinding === finding.id ? 'Resolving...' : 'Resolve'}
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {resolvedFindings(account.id).length > 0 && (
                        <div>
                          <h4 className="text-slate-400 text-sm font-medium mb-2">
                            Resolved ({resolvedFindings(account.id).length})
                          </h4>
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm opacity-60">
                              <thead>
                                <tr className="text-xs text-slate-500 uppercase tracking-wider">
                                  <th className="text-left py-1.5 pr-4">Rule ID</th>
                                  <th className="text-left py-1.5 pr-4">Resource</th>
                                  <th className="text-left py-1.5 pr-4">Severity</th>
                                  <th className="text-left py-1.5">Title</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-700/30">
                                {resolvedFindings(account.id).map(finding => (
                                  <tr key={finding.id}>
                                    <td className="py-1.5 pr-4 text-slate-500 font-mono text-xs">{finding.ruleId}</td>
                                    <td className="py-1.5 pr-4 text-slate-500 text-xs">{finding.resourceType}</td>
                                    <td className="py-1.5 pr-4">
                                      <span className="px-2 py-0.5 bg-slate-700/50 text-slate-500 rounded text-xs">{finding.severity}</span>
                                    </td>
                                    <td className="py-1.5 text-slate-500 text-xs line-through max-w-xs truncate">{finding.title}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default CloudSecurity;
