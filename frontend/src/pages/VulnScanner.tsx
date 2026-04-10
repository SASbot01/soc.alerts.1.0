import React, { useEffect, useState, useCallback } from 'react';
import {
  ScanLine, Plus, CheckCircle, AlertTriangle, RefreshCw,
  ChevronDown, ChevronRight, ExternalLink, X, ShieldCheck
} from 'lucide-react';
import api from '../lib/api';

interface VulnScan {
  id: string;
  target: string;
  scanType: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt: string;
  completedAt: string | null;
  findingsCount: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
}

interface Finding {
  id: string;
  scanId: string;
  cveId: string | null;
  title: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  cvssScore: number | null;
  affectedComponent: string;
  status: 'open' | 'resolved' | 'accepted';
  description: string | null;
}

interface VulnStats {
  totalScans: number;
  openFindings: number;
  criticalFindings: number;
  highFindings: number;
}

const SCAN_TYPES = ['full', 'quick', 'web', 'network', 'compliance'];

const statusBadge = (status: VulnScan['status']) => {
  const map: Record<string, string> = {
    pending: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
    running: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
    completed: 'bg-green-500/10 text-green-400 border border-green-500/20',
    failed: 'bg-red-500/10 text-red-400 border border-red-500/20',
  };
  return map[status] ?? 'bg-slate-700 text-slate-300';
};

const severityBadge = (sev: Finding['severity']) => {
  const map: Record<string, string> = {
    critical: 'bg-red-500/10 text-red-400 border border-red-500/20',
    high: 'bg-orange-500/10 text-orange-400 border border-orange-500/20',
    medium: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
    low: 'bg-green-500/10 text-green-400 border border-green-500/20',
    info: 'bg-slate-700/50 text-slate-300 border border-slate-600',
  };
  return map[sev] ?? 'bg-slate-700 text-slate-300';
};

const findingStatusBadge = (status: Finding['status']) => {
  const map: Record<string, string> = {
    open: 'bg-red-500/10 text-red-400 border border-red-500/20',
    resolved: 'bg-green-500/10 text-green-400 border border-green-500/20',
    accepted: 'bg-slate-700/50 text-slate-300 border border-slate-600',
  };
  return map[status] ?? 'bg-slate-700 text-slate-300';
};

const fmt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' }) : '—';

const VulnScanner: React.FC = () => {
  const companyId = (JSON.parse(localStorage.getItem('user') || '{}') as { companyId?: string }).companyId;

  const [scans, setScans] = useState<VulnScan[]>([]);
  const [stats, setStats] = useState<VulnStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedScan, setExpandedScan] = useState<string | null>(null);
  const [scanFindings, setScanFindings] = useState<Record<string, Finding[]>>({});
  const [findingsLoading, setFindingsLoading] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const [newScan, setNewScan] = useState({ target: '', scanType: 'quick' });
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [sr, statR] = await Promise.all([
        api.get('/vuln-scanner/scans', { params: { companyId } }),
        api.get('/vuln-scanner/stats', { params: { companyId } }),
      ]);
      setScans(Array.isArray(sr.data) ? sr.data : sr.data.scans ?? sr.data.content ?? []);
      setStats(statR.data);
    } catch (e) {
      console.error('Failed to load vuln scanner data', e);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => { loadData(); }, [loadData]);

  const toggleExpand = async (id: string) => {
    if (expandedScan === id) { setExpandedScan(null); return; }
    setExpandedScan(id);
    if (scanFindings[id]) return;
    setFindingsLoading(id);
    try {
      const r = await api.get(`/vuln-scanner/scans/${id}/findings`);
      setScanFindings(prev => ({ ...prev, [id]: Array.isArray(r.data) ? r.data : r.data.findings ?? [] }));
    } catch (e) {
      console.error('Failed to load findings', e);
    } finally {
      setFindingsLoading(null);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError('');
    if (!newScan.target.trim()) { setCreateError('Target is required.'); return; }
    setCreateLoading(true);
    try {
      await api.post('/vuln-scanner/scans', { ...newScan, companyId });
      setNewScan({ target: '', scanType: 'quick' });
      setShowCreateForm(false);
      await loadData();
    } catch (e) {
      setCreateError('Failed to create scan.');
      console.error(e);
    } finally {
      setCreateLoading(false);
    }
  };

  const handleComplete = async (id: string) => {
    setActionLoading(id);
    try {
      await api.post(`/vuln-scanner/scans/${id}/complete`);
      await loadData();
    } catch (e) {
      console.error('Failed to complete scan', e);
    } finally {
      setActionLoading(null);
    }
  };

  const handleFindingStatus = async (findingId: string, status: 'resolved' | 'accepted') => {
    setActionLoading(findingId);
    try {
      await api.put(`/vuln-scanner/findings/${findingId}/status`, null, { params: { status } });
      setScanFindings(prev => {
        const updated: Record<string, Finding[]> = {};
        for (const [k, v] of Object.entries(prev)) {
          updated[k] = v.map(f => f.id === findingId ? { ...f, status } : f);
        }
        return updated;
      });
    } catch (e) {
      console.error('Failed to update finding status', e);
    } finally {
      setActionLoading(null);
    }
  };

  const statCards = [
    { label: 'Total Scans', value: stats?.totalScans ?? 0, color: 'text-white', icon: <ScanLine className="w-5 h-5 text-blue-400" /> },
    { label: 'Open Findings', value: stats?.openFindings ?? 0, color: 'text-amber-400', icon: <AlertTriangle className="w-5 h-5 text-amber-400" /> },
    { label: 'Critical Findings', value: stats?.criticalFindings ?? 0, color: 'text-red-400', icon: <AlertTriangle className="w-5 h-5 text-red-400" /> },
    { label: 'High Findings', value: stats?.highFindings ?? 0, color: 'text-orange-400', icon: <AlertTriangle className="w-5 h-5 text-orange-400" /> },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <ScanLine className="w-7 h-7 text-blue-400" />
            Vulnerability Scanner
          </h1>
          <p className="text-slate-400 text-sm mt-1">Scan targets for vulnerabilities and track remediation status</p>
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
            New Scan
          </button>
        </div>
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
              {loading ? '—' : card.value.toLocaleString()}
            </div>
          </div>
        ))}
      </div>

      {/* Create Scan Form */}
      {showCreateForm && (
        <div className="bg-slate-900 border border-blue-500/30 rounded-lg p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <Plus className="w-4 h-4 text-blue-400" />
              New Scan
            </h2>
            <button onClick={() => setShowCreateForm(false)} className="text-slate-500 hover:text-slate-300">
              <X className="w-4 h-4" />
            </button>
          </div>
          <form onSubmit={handleCreate} className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-48">
              <label className="block text-xs text-slate-400 mb-1">Target <span className="text-red-400">*</span></label>
              <input
                type="text"
                placeholder="e.g. 192.168.1.1 or https://example.com"
                value={newScan.target}
                onChange={e => setNewScan(p => ({ ...p, target: e.target.value }))}
                className="w-full bg-slate-800 border border-slate-600 rounded-md px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Scan Type</label>
              <select
                value={newScan.scanType}
                onChange={e => setNewScan(p => ({ ...p, scanType: e.target.value }))}
                className="bg-slate-800 border border-slate-600 rounded-md px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
              >
                {SCAN_TYPES.map(t => (
                  <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                ))}
              </select>
            </div>
            {createError && (
              <div className="w-full text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded px-3 py-2">
                {createError}
              </div>
            )}
            <div className="flex gap-2">
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
                {createLoading ? 'Starting...' : 'Start Scan'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Scans Table */}
      <div className="bg-slate-900 border border-slate-700 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-700">
          <h2 className="text-sm font-semibold text-slate-200">Scans</h2>
        </div>
        {loading ? (
          <div className="flex items-center justify-center h-40 text-slate-400 text-sm">Loading scans...</div>
        ) : scans.length === 0 ? (
          <div className="flex items-center justify-center h-40 text-slate-500 text-sm">No scans yet. Start a new scan above.</div>
        ) : (
          <div className="divide-y divide-slate-700/50">
            {scans.map(scan => (
              <div key={scan.id}>
                <div className="flex items-center gap-3 px-4 py-3 hover:bg-slate-800/30 transition-colors">
                  <button onClick={() => toggleExpand(scan.id)} className="text-slate-500 hover:text-slate-300 flex-shrink-0">
                    {expandedScan === scan.id
                      ? <ChevronDown className="w-4 h-4" />
                      : <ChevronRight className="w-4 h-4" />}
                  </button>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-slate-200 font-mono">{scan.target}</span>
                      <span className="px-2 py-0.5 rounded text-xs bg-slate-700/50 text-slate-300 border border-slate-600">
                        {scan.scanType}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusBadge(scan.status)}`}>
                        {scan.status}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      Started {fmt(scan.startedAt)} &middot; Completed {fmt(scan.completedAt)}
                    </div>
                  </div>

                  {/* Finding counts */}
                  <div className="hidden sm:flex items-center gap-2 flex-shrink-0">
                    {scan.criticalCount > 0 && (
                      <span className="px-1.5 py-0.5 rounded text-xs font-bold bg-red-500/10 text-red-400 border border-red-500/20">
                        {scan.criticalCount} crit
                      </span>
                    )}
                    {scan.highCount > 0 && (
                      <span className="px-1.5 py-0.5 rounded text-xs font-bold bg-orange-500/10 text-orange-400 border border-orange-500/20">
                        {scan.highCount} high
                      </span>
                    )}
                    <span className="px-1.5 py-0.5 rounded text-xs bg-slate-800 text-slate-400 border border-slate-700">
                      {scan.findingsCount} total
                    </span>
                  </div>

                  {/* Complete button for pending */}
                  {scan.status === 'pending' && (
                    <button
                      onClick={() => handleComplete(scan.id)}
                      disabled={actionLoading === scan.id}
                      className="flex items-center gap-1 px-2 py-1 bg-green-600 hover:bg-green-500 rounded text-white text-xs font-medium transition-colors disabled:opacity-50 flex-shrink-0"
                    >
                      <CheckCircle className="w-3 h-3" />
                      {actionLoading === scan.id ? '...' : 'Complete'}
                    </button>
                  )}
                </div>

                {/* Expanded Findings */}
                {expandedScan === scan.id && (
                  <div className="bg-slate-950/50 border-t border-slate-700/50 px-8 py-4">
                    <h3 className="text-xs font-semibold text-slate-300 mb-3 flex items-center gap-2">
                      <ShieldCheck className="w-3 h-3 text-blue-400" />
                      Findings
                    </h3>
                    {findingsLoading === scan.id ? (
                      <div className="text-slate-400 text-sm py-4">Loading findings...</div>
                    ) : !scanFindings[scan.id] || scanFindings[scan.id].length === 0 ? (
                      <div className="text-slate-500 text-sm py-4">No findings recorded.</div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-slate-500 border-b border-slate-700">
                              <th className="py-2 pr-4 text-left font-medium">CVE ID</th>
                              <th className="py-2 pr-4 text-left font-medium">Title</th>
                              <th className="py-2 pr-4 text-left font-medium">Severity</th>
                              <th className="py-2 pr-4 text-left font-medium">CVSS</th>
                              <th className="py-2 pr-4 text-left font-medium">Component</th>
                              <th className="py-2 pr-4 text-left font-medium">Status</th>
                              <th className="py-2 text-left font-medium">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-700/30">
                            {scanFindings[scan.id].map(f => (
                              <tr key={f.id} className="hover:bg-slate-800/20">
                                <td className="py-2 pr-4">
                                  {f.cveId ? (
                                    <span className="text-blue-400 hover:text-blue-300 cursor-pointer flex items-center gap-1 font-mono">
                                      {f.cveId}
                                      <ExternalLink className="w-3 h-3" />
                                    </span>
                                  ) : <span className="text-slate-500">—</span>}
                                </td>
                                <td className="py-2 pr-4 text-slate-300 max-w-xs truncate" title={f.title}>{f.title}</td>
                                <td className="py-2 pr-4">
                                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${severityBadge(f.severity)}`}>
                                    {f.severity}
                                  </span>
                                </td>
                                <td className="py-2 pr-4 font-mono text-slate-300">
                                  {f.cvssScore != null ? f.cvssScore.toFixed(1) : '—'}
                                </td>
                                <td className="py-2 pr-4 text-slate-400 font-mono truncate max-w-32" title={f.affectedComponent}>
                                  {f.affectedComponent}
                                </td>
                                <td className="py-2 pr-4">
                                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${findingStatusBadge(f.status)}`}>
                                    {f.status}
                                  </span>
                                </td>
                                <td className="py-2">
                                  {f.status === 'open' && (
                                    <div className="flex items-center gap-1">
                                      <button
                                        onClick={() => handleFindingStatus(f.id, 'resolved')}
                                        disabled={actionLoading === f.id}
                                        className="px-2 py-0.5 bg-green-600 hover:bg-green-500 rounded text-white text-xs disabled:opacity-50"
                                      >
                                        Resolve
                                      </button>
                                      <button
                                        onClick={() => handleFindingStatus(f.id, 'accepted')}
                                        disabled={actionLoading === f.id}
                                        className="px-2 py-0.5 bg-slate-700 hover:bg-slate-600 rounded text-slate-300 text-xs disabled:opacity-50"
                                      >
                                        Accept
                                      </button>
                                    </div>
                                  )}
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

export default VulnScanner;
