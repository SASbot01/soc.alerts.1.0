import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { Plus, X, ChevronDown, ChevronUp, RefreshCw, FolderOpen, Lock, FileText, Clock } from 'lucide-react';

interface ForensicCase {
  id: string;
  title: string;
  description: string;
  status: 'open' | 'in_progress' | 'closed';
  severity: string;
  leadAnalyst: string;
  createdAt: string;
  closedAt: string | null;
}

interface Evidence {
  id: string;
  type: string;
  name: string;
  hash: string;
  collectedAt: string;
  collectedBy: string;
}

interface TimelineEvent {
  id: string;
  timestamp: string;
  eventType: string;
  description: string;
  source: string;
}

interface ForensicsStats {
  openCases: number;
  totalEvidence: number;
  recentCases: number;
}

const statusBadge = (status: string) => {
  if (status === 'open') return 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30';
  if (status === 'in_progress') return 'bg-blue-500/20 text-blue-400 border border-blue-500/30';
  if (status === 'closed') return 'bg-green-500/20 text-green-400 border border-green-500/30';
  return 'bg-slate-700 text-slate-400';
};

const severityBadge = (s: string) => {
  const v = s?.toLowerCase();
  if (v === 'critical') return 'bg-red-600 text-white';
  if (v === 'high') return 'bg-red-500/20 text-red-400';
  if (v === 'medium') return 'bg-amber-500/20 text-amber-400';
  return 'bg-blue-500/20 text-blue-400';
};

const inputCls = 'w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:border-blue-500 focus:outline-none placeholder-slate-500';
const labelCls = 'block text-xs text-slate-400 mb-1';

const Forensics: React.FC = () => {
  const { user } = useAuth();
  const companyId = user?.companyId;
  const token = localStorage.getItem('token');

  const [cases, setCases] = useState<ForensicCase[]>([]);
  const [stats, setStats] = useState<ForensicsStats>({ openCases: 0, totalEvidence: 0, recentCases: 0 });
  const [loading, setLoading] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [caseForm, setCaseForm] = useState({ title: '', description: '', severity: 'medium', leadAnalyst: '' });
  const [saving, setSaving] = useState(false);

  // Case detail state
  const [expandedCase, setExpandedCase] = useState<string | null>(null);
  const [activeDetailTab, setActiveDetailTab] = useState<Record<string, 'evidence' | 'timeline'>>({});
  const [evidence, setEvidence] = useState<Record<string, Evidence[]>>({});
  const [timeline, setTimeline] = useState<Record<string, TimelineEvent[]>>({});
  const [loadingDetail, setLoadingDetail] = useState<string | null>(null);

  // Add evidence form
  const [showEvidenceForm, setShowEvidenceForm] = useState<string | null>(null);
  const [evidenceForm, setEvidenceForm] = useState({ type: '', name: '', hash: '', collectedBy: '' });
  // Add timeline form
  const [showTimelineForm, setShowTimelineForm] = useState<string | null>(null);
  const [timelineForm, setTimelineForm] = useState({ timestamp: '', eventType: '', description: '', source: '' });

  const api = (path: string, opts?: RequestInit) =>
    fetch(`/api/v1${path}`, {
      ...opts,
      headers: { ...opts?.headers, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    });

  const fetchAll = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const [casesRes, statsRes] = await Promise.all([
        api(`/forensics/cases?companyId=${companyId}`),
        api(`/forensics/stats?companyId=${companyId}`),
      ]);
      if (casesRes.ok) setCases(await casesRes.json());
      if (statsRes.ok) setStats(await statsRes.json());
    } catch (err) {
      console.error('Failed to load forensics data:', err);
    } finally {
      setLoading(false);
    }
  }, [companyId, token]);

  useEffect(() => { fetchAll(); }, []);

  const createCase = async () => {
    if (!caseForm.title.trim() || !companyId) return;
    setSaving(true);
    try {
      const res = await api('/forensics/cases', {
        method: 'POST',
        body: JSON.stringify({ ...caseForm, companyId }),
      });
      if (res.ok) {
        setShowCreateForm(false);
        setCaseForm({ title: '', description: '', severity: 'medium', leadAnalyst: '' });
        fetchAll();
      }
    } catch (err) {
      console.error('Failed to create case:', err);
    } finally {
      setSaving(false);
    }
  };

  const closeCase = async (caseId: string) => {
    try {
      const res = await api(`/forensics/cases/${caseId}/close`, { method: 'POST' });
      if (res.ok) fetchAll();
    } catch (err) {
      console.error('Failed to close case:', err);
    }
  };

  const loadCaseDetail = async (caseId: string, tab: 'evidence' | 'timeline') => {
    setActiveDetailTab(prev => ({ ...prev, [caseId]: tab }));
    if (tab === 'evidence' && !evidence[caseId]) {
      setLoadingDetail(caseId);
      try {
        const res = await api(`/forensics/cases/${caseId}/evidence`);
        if (res.ok) {
          const data = await res.json();
          setEvidence(prev => ({ ...prev, [caseId]: data }));
        }
      } catch (err) {
        console.error('Failed to load evidence:', err);
      } finally {
        setLoadingDetail(null);
      }
    }
    if (tab === 'timeline' && !timeline[caseId]) {
      setLoadingDetail(caseId);
      try {
        const res = await api(`/forensics/cases/${caseId}/timeline`);
        if (res.ok) {
          const data = await res.json();
          setTimeline(prev => ({ ...prev, [caseId]: data }));
        }
      } catch (err) {
        console.error('Failed to load timeline:', err);
      } finally {
        setLoadingDetail(null);
      }
    }
  };

  const toggleCase = (caseId: string) => {
    if (expandedCase === caseId) {
      setExpandedCase(null);
    } else {
      setExpandedCase(caseId);
      const tab = activeDetailTab[caseId] ?? 'evidence';
      loadCaseDetail(caseId, tab);
    }
  };

  const addEvidence = async (caseId: string) => {
    if (!evidenceForm.name.trim()) return;
    setSaving(true);
    try {
      const res = await api(`/forensics/cases/${caseId}/evidence`, {
        method: 'POST',
        body: JSON.stringify(evidenceForm),
      });
      if (res.ok) {
        setShowEvidenceForm(null);
        setEvidenceForm({ type: '', name: '', hash: '', collectedBy: '' });
        setEvidence(prev => ({ ...prev, [caseId]: undefined as any }));
        loadCaseDetail(caseId, 'evidence');
      }
    } catch (err) {
      console.error('Failed to add evidence:', err);
    } finally {
      setSaving(false);
    }
  };

  const addTimelineEvent = async (caseId: string) => {
    if (!timelineForm.description.trim()) return;
    setSaving(true);
    try {
      const res = await api(`/forensics/cases/${caseId}/timeline`, {
        method: 'POST',
        body: JSON.stringify(timelineForm),
      });
      if (res.ok) {
        setShowTimelineForm(null);
        setTimelineForm({ timestamp: '', eventType: '', description: '', source: '' });
        setTimeline(prev => ({ ...prev, [caseId]: undefined as any }));
        loadCaseDetail(caseId, 'timeline');
      }
    } catch (err) {
      console.error('Failed to add timeline event:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Digital Forensics</h1>
          <p className="text-slate-400 text-sm mt-1">Manage forensic cases, evidence, and investigation timelines</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowCreateForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm"
          >
            <Plus className="w-4 h-4" />
            Create Case
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
          { label: 'Open Cases', value: stats.openCases, icon: <FolderOpen className="w-5 h-5 text-yellow-400" />, color: 'text-yellow-400' },
          { label: 'Total Evidence', value: stats.totalEvidence, icon: <FileText className="w-5 h-5 text-blue-400" />, color: 'text-blue-400' },
          { label: 'Recent Cases (7d)', value: stats.recentCases, icon: <Clock className="w-5 h-5 text-green-400" />, color: 'text-green-400' },
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

      {/* Create Case Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-slate-900 border border-slate-700 rounded-lg p-6 w-full max-w-lg">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-semibold">Create Forensic Case</h3>
              <button onClick={() => setShowCreateForm(false)} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className={labelCls}>Case Title</label>
                <input type="text" value={caseForm.title} onChange={e => setCaseForm({ ...caseForm, title: e.target.value })} placeholder="Brief descriptive title" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Description</label>
                <textarea value={caseForm.description} onChange={e => setCaseForm({ ...caseForm, description: e.target.value })} rows={3} placeholder="Case details and context..." className={`${inputCls} resize-none`} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Severity</label>
                  <select value={caseForm.severity} onChange={e => setCaseForm({ ...caseForm, severity: e.target.value })} className={inputCls}>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Lead Analyst</label>
                  <input type="text" value={caseForm.leadAnalyst} onChange={e => setCaseForm({ ...caseForm, leadAnalyst: e.target.value })} placeholder="Analyst name or email" className={inputCls} />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setShowCreateForm(false)} className="px-4 py-2 text-slate-400 hover:text-white transition text-sm">Cancel</button>
              <button onClick={createCase} disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition text-sm">
                {saving ? 'Creating...' : 'Create Case'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cases List */}
      <div className="space-y-3">
        {cases.length === 0 ? (
          <div className="bg-slate-900 border border-slate-700 rounded-lg p-12 text-center text-slate-500">
            No forensic cases. Create your first case to begin an investigation.
          </div>
        ) : (
          cases.map(c => (
            <div key={c.id} className="bg-slate-900 border border-slate-700 rounded-lg overflow-hidden">
              {/* Case Header */}
              <div
                className="flex items-center gap-4 p-4 cursor-pointer hover:bg-slate-800/40 transition"
                onClick={() => toggleCase(c.id)}
              >
                <FolderOpen className="w-5 h-5 text-slate-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-white font-medium">{c.title}</h3>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusBadge(c.status)}`}>
                      {c.status?.replace('_', ' ')}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${severityBadge(c.severity)}`}>
                      {c.severity}
                    </span>
                  </div>
                  <p className="text-slate-400 text-xs mt-0.5">
                    Lead: {c.leadAnalyst || '—'} · Created {new Date(c.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {c.status !== 'closed' && (
                    <button
                      onClick={e => { e.stopPropagation(); closeCase(c.id); }}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 transition text-xs"
                    >
                      <Lock className="w-3.5 h-3.5" />
                      Close
                    </button>
                  )}
                  {expandedCase === c.id
                    ? <ChevronUp className="w-5 h-5 text-slate-400" />
                    : <ChevronDown className="w-5 h-5 text-slate-400" />}
                </div>
              </div>

              {/* Case Detail */}
              {expandedCase === c.id && (
                <div className="border-t border-slate-700">
                  {/* Tabs */}
                  <div className="flex border-b border-slate-700">
                    {(['evidence', 'timeline'] as const).map(tab => (
                      <button
                        key={tab}
                        onClick={() => loadCaseDetail(c.id, tab)}
                        className={`px-5 py-2.5 text-sm font-medium transition ${
                          (activeDetailTab[c.id] ?? 'evidence') === tab
                            ? 'text-white border-b-2 border-blue-500 bg-slate-800/30'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        {tab === 'evidence' ? 'Evidence' : 'Timeline'}
                      </button>
                    ))}
                  </div>

                  <div className="p-4">
                    {loadingDetail === c.id ? (
                      <p className="text-slate-400 text-sm text-center py-4">Loading...</p>
                    ) : (activeDetailTab[c.id] ?? 'evidence') === 'evidence' ? (
                      <>
                        <div className="flex justify-end mb-3">
                          <button
                            onClick={() => setShowEvidenceForm(showEvidenceForm === c.id ? null : c.id)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-xs"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            Add Evidence
                          </button>
                        </div>

                        {showEvidenceForm === c.id && (
                          <div className="bg-slate-800/50 rounded-lg p-3 mb-3">
                            <div className="grid grid-cols-2 gap-3 mb-3">
                              <div>
                                <label className={labelCls}>Type</label>
                                <input type="text" value={evidenceForm.type} onChange={e => setEvidenceForm({ ...evidenceForm, type: e.target.value })} placeholder="e.g. disk_image, memory_dump" className={inputCls} />
                              </div>
                              <div>
                                <label className={labelCls}>Name</label>
                                <input type="text" value={evidenceForm.name} onChange={e => setEvidenceForm({ ...evidenceForm, name: e.target.value })} placeholder="Evidence name" className={inputCls} />
                              </div>
                              <div>
                                <label className={labelCls}>Hash (SHA-256)</label>
                                <input type="text" value={evidenceForm.hash} onChange={e => setEvidenceForm({ ...evidenceForm, hash: e.target.value })} placeholder="Hash value" className={inputCls} />
                              </div>
                              <div>
                                <label className={labelCls}>Collected By</label>
                                <input type="text" value={evidenceForm.collectedBy} onChange={e => setEvidenceForm({ ...evidenceForm, collectedBy: e.target.value })} placeholder="Analyst name" className={inputCls} />
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <button onClick={() => addEvidence(c.id)} disabled={saving} className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition text-xs">{saving ? 'Saving...' : 'Add'}</button>
                              <button onClick={() => setShowEvidenceForm(null)} className="px-3 py-1.5 text-slate-400 hover:text-white transition text-xs">Cancel</button>
                            </div>
                          </div>
                        )}

                        {(evidence[c.id] ?? []).length === 0 ? (
                          <p className="text-slate-500 text-sm text-center py-4">No evidence collected for this case.</p>
                        ) : (
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="text-xs text-slate-400 uppercase tracking-wider">
                                <th className="text-left py-2 pr-4">Type</th>
                                <th className="text-left py-2 pr-4">Name</th>
                                <th className="text-left py-2 pr-4">Hash</th>
                                <th className="text-left py-2 pr-4">Collected</th>
                                <th className="text-left py-2">By</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-700/50">
                              {(evidence[c.id] ?? []).map(ev => (
                                <tr key={ev.id} className="hover:bg-slate-800/30 transition">
                                  <td className="py-2 pr-4">
                                    <span className="px-2 py-0.5 bg-slate-700 text-slate-300 rounded text-xs">{ev.type}</span>
                                  </td>
                                  <td className="py-2 pr-4 text-slate-300">{ev.name}</td>
                                  <td className="py-2 pr-4 text-slate-400 font-mono text-xs max-w-xs truncate">{ev.hash || '—'}</td>
                                  <td className="py-2 pr-4 text-slate-400 text-xs whitespace-nowrap">
                                    {ev.collectedAt ? new Date(ev.collectedAt).toLocaleString() : '—'}
                                  </td>
                                  <td className="py-2 text-slate-400 text-xs">{ev.collectedBy}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </>
                    ) : (
                      <>
                        <div className="flex justify-end mb-3">
                          <button
                            onClick={() => setShowTimelineForm(showTimelineForm === c.id ? null : c.id)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-xs"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            Add Event
                          </button>
                        </div>

                        {showTimelineForm === c.id && (
                          <div className="bg-slate-800/50 rounded-lg p-3 mb-3">
                            <div className="grid grid-cols-2 gap-3 mb-3">
                              <div>
                                <label className={labelCls}>Timestamp</label>
                                <input type="datetime-local" value={timelineForm.timestamp} onChange={e => setTimelineForm({ ...timelineForm, timestamp: e.target.value })} className={inputCls} />
                              </div>
                              <div>
                                <label className={labelCls}>Event Type</label>
                                <input type="text" value={timelineForm.eventType} onChange={e => setTimelineForm({ ...timelineForm, eventType: e.target.value })} placeholder="e.g. initial_access, lateral_movement" className={inputCls} />
                              </div>
                              <div className="col-span-2">
                                <label className={labelCls}>Description</label>
                                <textarea value={timelineForm.description} onChange={e => setTimelineForm({ ...timelineForm, description: e.target.value })} rows={2} placeholder="What happened..." className={`${inputCls} resize-none`} />
                              </div>
                              <div>
                                <label className={labelCls}>Source</label>
                                <input type="text" value={timelineForm.source} onChange={e => setTimelineForm({ ...timelineForm, source: e.target.value })} placeholder="e.g. firewall log, endpoint" className={inputCls} />
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <button onClick={() => addTimelineEvent(c.id)} disabled={saving} className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition text-xs">{saving ? 'Saving...' : 'Add Event'}</button>
                              <button onClick={() => setShowTimelineForm(null)} className="px-3 py-1.5 text-slate-400 hover:text-white transition text-xs">Cancel</button>
                            </div>
                          </div>
                        )}

                        {(timeline[c.id] ?? []).length === 0 ? (
                          <p className="text-slate-500 text-sm text-center py-4">No timeline events recorded for this case.</p>
                        ) : (
                          <div className="space-y-3">
                            {(timeline[c.id] ?? []).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()).map(ev => (
                              <div key={ev.id} className="flex gap-3">
                                <div className="flex flex-col items-center">
                                  <div className="w-2.5 h-2.5 rounded-full bg-blue-500 mt-0.5 shrink-0" />
                                  <div className="w-0.5 bg-slate-700 flex-1 mt-1" />
                                </div>
                                <div className="pb-3 flex-1">
                                  <div className="flex items-center gap-2 mb-0.5">
                                    <span className="text-slate-300 text-xs font-mono whitespace-nowrap">
                                      {ev.timestamp ? new Date(ev.timestamp).toLocaleString() : '—'}
                                    </span>
                                    {ev.eventType && (
                                      <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 rounded text-xs">{ev.eventType}</span>
                                    )}
                                    {ev.source && <span className="text-slate-500 text-xs">· {ev.source}</span>}
                                  </div>
                                  <p className="text-slate-300 text-sm">{ev.description}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default Forensics;
