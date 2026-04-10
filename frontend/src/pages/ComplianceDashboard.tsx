import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { Plus, Play, CheckCircle, XCircle, MinusCircle, ChevronDown, ChevronUp, X, RefreshCw, ClipboardList } from 'lucide-react';

interface Framework {
  id: string;
  name: string;
  version: string;
  description: string;
  totalControls: number;
  enabled: boolean;
}

interface Assessment {
  id: string;
  frameworkId: string;
  frameworkName: string;
  status: string;
  score: number;
  passedControls: number;
  failedControls: number;
  naControls: number;
  startedAt: string;
  completedAt: string | null;
}

interface ControlResult {
  id: string;
  controlId: string;
  controlName: string;
  description: string;
  status: 'pass' | 'fail' | 'na' | null;
  notes: string;
}

interface ComplianceStats {
  frameworksCount: number;
  latestScore: number;
  totalControls: number;
}

const statusColor = (s: string) => {
  if (s === 'completed') return 'bg-green-500/20 text-green-400';
  if (s === 'in_progress') return 'bg-blue-500/20 text-blue-400';
  return 'bg-slate-700 text-slate-400';
};

const scoreColor = (score: number) => {
  if (score >= 80) return 'text-green-400';
  if (score >= 60) return 'text-amber-400';
  return 'text-red-400';
};

const scoreBarColor = (score: number) => {
  if (score >= 80) return 'bg-green-500';
  if (score >= 60) return 'bg-amber-500';
  return 'bg-red-500';
};

const inputCls = 'w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:border-blue-500 focus:outline-none placeholder-slate-500';
const labelCls = 'block text-xs text-slate-400 mb-1';

const ComplianceDashboard: React.FC = () => {
  const { user } = useAuth();
  const companyId = user?.companyId;
  const token = localStorage.getItem('token');

  const [frameworks, setFrameworks] = useState<Framework[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [stats, setStats] = useState<ComplianceStats>({ frameworksCount: 0, latestScore: 0, totalControls: 0 });
  const [loading, setLoading] = useState(false);
  const [showFrameworkForm, setShowFrameworkForm] = useState(false);
  const [frameworkForm, setFrameworkForm] = useState({ name: '', version: '', description: '' });
  const [saving, setSaving] = useState(false);
  const [selectedAssessment, setSelectedAssessment] = useState<string | null>(null);
  const [controlResults, setControlResults] = useState<ControlResult[]>([]);
  const [loadingControls, setLoadingControls] = useState(false);
  const [pendingResults, setPendingResults] = useState<Record<string, { status: 'pass' | 'fail' | 'na' | null; notes: string }>>({});

  const api = (path: string, opts?: RequestInit) =>
    fetch(`/api/v1${path}`, {
      ...opts,
      headers: { ...opts?.headers, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    });

  const fetchAll = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const [fwRes, assRes, statsRes] = await Promise.all([
        api(`/compliance/frameworks?companyId=${companyId}`),
        api(`/compliance/assessments?companyId=${companyId}`),
        api(`/compliance/stats?companyId=${companyId}`),
      ]);
      if (fwRes.ok) setFrameworks(await fwRes.json());
      if (assRes.ok) setAssessments(await assRes.json());
      if (statsRes.ok) setStats(await statsRes.json());
    } catch (err) {
      console.error('Failed to load compliance data:', err);
    } finally {
      setLoading(false);
    }
  }, [companyId, token]);

  useEffect(() => { fetchAll(); }, []);

  const createFramework = async () => {
    if (!frameworkForm.name.trim() || !companyId) return;
    setSaving(true);
    try {
      const res = await api('/compliance/frameworks', {
        method: 'POST',
        body: JSON.stringify({ ...frameworkForm, companyId }),
      });
      if (res.ok) {
        setShowFrameworkForm(false);
        setFrameworkForm({ name: '', version: '', description: '' });
        fetchAll();
      }
    } catch (err) {
      console.error('Failed to create framework:', err);
    } finally {
      setSaving(false);
    }
  };

  const startAssessment = async (frameworkId: string) => {
    if (!companyId) return;
    try {
      const res = await api('/compliance/assessments/start', {
        method: 'POST',
        body: JSON.stringify({ frameworkId, companyId }),
      });
      if (res.ok) fetchAll();
    } catch (err) {
      console.error('Failed to start assessment:', err);
    }
  };

  const loadAssessmentResults = async (assessmentId: string) => {
    if (selectedAssessment === assessmentId) {
      setSelectedAssessment(null);
      return;
    }
    setSelectedAssessment(assessmentId);
    setLoadingControls(true);
    try {
      const res = await api(`/compliance/assessments/${assessmentId}/results`);
      if (res.ok) {
        const data: ControlResult[] = await res.json();
        setControlResults(data);
        const initial: Record<string, { status: 'pass' | 'fail' | 'na' | null; notes: string }> = {};
        data.forEach(c => { initial[c.controlId] = { status: c.status, notes: c.notes || '' }; });
        setPendingResults(initial);
      }
    } catch (err) {
      console.error('Failed to load assessment results:', err);
    } finally {
      setLoadingControls(false);
    }
  };

  const saveControlResult = async (assessmentId: string, controlId: string) => {
    const result = pendingResults[controlId];
    if (!result) return;
    try {
      await api(`/compliance/assessments/${assessmentId}/results`, {
        method: 'POST',
        body: JSON.stringify({ controlId, status: result.status, notes: result.notes }),
      });
    } catch (err) {
      console.error('Failed to save control result:', err);
    }
  };

  const completeAssessment = async (assessmentId: string) => {
    try {
      const res = await api(`/compliance/assessments/${assessmentId}/complete`, { method: 'POST' });
      if (res.ok) {
        setSelectedAssessment(null);
        fetchAll();
      }
    } catch (err) {
      console.error('Failed to complete assessment:', err);
    }
  };

  const updatePending = (controlId: string, field: 'status' | 'notes', value: string) => {
    setPendingResults(prev => ({
      ...prev,
      [controlId]: { ...prev[controlId], [field]: value as any },
    }));
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Compliance Dashboard</h1>
          <p className="text-slate-400 text-sm mt-1">Manage compliance frameworks and track assessment progress</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowFrameworkForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm"
          >
            <Plus className="w-4 h-4" />
            Add Framework
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
          { label: 'Frameworks', value: stats.frameworksCount, color: 'text-blue-400' },
          { label: 'Latest Score', value: `${stats.latestScore ?? 0}%`, color: scoreColor(stats.latestScore ?? 0) },
          { label: 'Total Controls', value: stats.totalControls, color: 'text-purple-400' },
        ].map(s => (
          <div key={s.label} className="bg-slate-900 border border-slate-700 rounded-lg p-4">
            <p className="text-slate-400 text-xs mb-1">{s.label}</p>
            <p className={`text-3xl font-bold ${s.color}`}>{typeof s.value === 'number' ? s.value.toLocaleString() : s.value}</p>
          </div>
        ))}
      </div>

      {/* Add Framework Modal */}
      {showFrameworkForm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-slate-900 border border-slate-700 rounded-lg p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-semibold">Add Compliance Framework</h3>
              <button onClick={() => setShowFrameworkForm(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className={labelCls}>Framework Name</label>
                <input type="text" value={frameworkForm.name} onChange={e => setFrameworkForm({ ...frameworkForm, name: e.target.value })} placeholder="e.g. SOC 2, ISO 27001" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Version</label>
                <input type="text" value={frameworkForm.version} onChange={e => setFrameworkForm({ ...frameworkForm, version: e.target.value })} placeholder="e.g. 2022" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Description</label>
                <textarea value={frameworkForm.description} onChange={e => setFrameworkForm({ ...frameworkForm, description: e.target.value })} rows={3} placeholder="Brief description..." className={`${inputCls} resize-none`} />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setShowFrameworkForm(false)} className="px-4 py-2 text-slate-400 hover:text-white transition text-sm">Cancel</button>
              <button onClick={createFramework} disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition text-sm">
                {saving ? 'Creating...' : 'Create Framework'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Frameworks */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-3">Frameworks</h2>
        {frameworks.length === 0 ? (
          <div className="bg-slate-900 border border-slate-700 rounded-lg p-8 text-center text-slate-500">
            No frameworks configured. Add your first compliance framework.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {frameworks.map(fw => (
              <div key={fw.id} className="bg-slate-900 border border-slate-700 rounded-lg p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-white font-semibold">{fw.name}</h3>
                    {fw.version && <span className="text-slate-400 text-xs">v{fw.version}</span>}
                  </div>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${fw.enabled ? 'bg-green-500/20 text-green-400' : 'bg-slate-700 text-slate-400'}`}>
                    {fw.enabled ? 'Active' : 'Inactive'}
                  </span>
                </div>
                {fw.description && <p className="text-slate-400 text-sm line-clamp-2">{fw.description}</p>}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">
                    <ClipboardList className="w-3.5 h-3.5 inline mr-1" />
                    {fw.totalControls} controls
                  </span>
                  <button
                    onClick={() => startAssessment(fw.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-xs"
                  >
                    <Play className="w-3 h-3" />
                    Start Assessment
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Active Assessments */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-3">Assessments</h2>
        <div className="space-y-3">
          {assessments.length === 0 ? (
            <div className="bg-slate-900 border border-slate-700 rounded-lg p-8 text-center text-slate-500">
              No assessments yet. Start an assessment from a framework above.
            </div>
          ) : (
            assessments.map(ass => (
              <div key={ass.id} className="bg-slate-900 border border-slate-700 rounded-lg overflow-hidden">
                <div
                  className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-800/40 transition"
                  onClick={() => loadAssessmentResults(ass.id)}
                >
                  <div className="flex items-center gap-4 flex-1">
                    <div className="min-w-0">
                      <h3 className="text-white font-medium">{ass.frameworkName}</h3>
                      <p className="text-slate-400 text-xs mt-0.5">
                        Started {new Date(ass.startedAt).toLocaleDateString()}
                        {ass.completedAt && ` · Completed ${new Date(ass.completedAt).toLocaleDateString()}`}
                      </p>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColor(ass.status)}`}>
                      {ass.status?.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="flex items-center gap-6 ml-4">
                    <div className="text-right">
                      <p className={`text-2xl font-bold ${scoreColor(ass.score ?? 0)}`}>{ass.score ?? 0}%</p>
                      <div className="w-24 bg-slate-700 rounded-full h-1.5 mt-1">
                        <div className={`h-1.5 rounded-full ${scoreBarColor(ass.score ?? 0)}`} style={{ width: `${ass.score ?? 0}%` }} />
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="flex items-center gap-1 text-green-400"><CheckCircle className="w-3.5 h-3.5" />{ass.passedControls}</span>
                      <span className="flex items-center gap-1 text-red-400"><XCircle className="w-3.5 h-3.5" />{ass.failedControls}</span>
                      <span className="flex items-center gap-1 text-slate-400"><MinusCircle className="w-3.5 h-3.5" />{ass.naControls}</span>
                    </div>
                    {selectedAssessment === ass.id
                      ? <ChevronUp className="w-5 h-5 text-slate-400" />
                      : <ChevronDown className="w-5 h-5 text-slate-400" />}
                  </div>
                </div>

                {selectedAssessment === ass.id && (
                  <div className="border-t border-slate-700 p-4">
                    {loadingControls ? (
                      <p className="text-slate-400 text-sm text-center py-4">Loading controls...</p>
                    ) : (
                      <>
                        <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                          {controlResults.map(ctrl => (
                            <div key={ctrl.controlId} className="bg-slate-800/50 rounded-lg p-3 flex items-start gap-3">
                              <div className="flex-1 min-w-0">
                                <p className="text-white text-sm font-medium">{ctrl.controlName}</p>
                                {ctrl.description && <p className="text-slate-400 text-xs mt-0.5">{ctrl.description}</p>}
                                <input
                                  type="text"
                                  value={pendingResults[ctrl.controlId]?.notes ?? ''}
                                  onChange={e => updatePending(ctrl.controlId, 'notes', e.target.value)}
                                  onBlur={() => saveControlResult(ass.id, ctrl.controlId)}
                                  placeholder="Add notes..."
                                  className="mt-2 w-full px-2 py-1.5 bg-slate-900 border border-slate-700 rounded text-white text-xs focus:border-blue-500 focus:outline-none placeholder-slate-600"
                                />
                              </div>
                              <div className="flex gap-1.5 shrink-0">
                                {(['pass', 'fail', 'na'] as const).map(s => (
                                  <button
                                    key={s}
                                    onClick={() => {
                                      updatePending(ctrl.controlId, 'status', s);
                                      setTimeout(() => saveControlResult(ass.id, ctrl.controlId), 100);
                                    }}
                                    className={`px-2.5 py-1 rounded text-xs font-medium transition ${
                                      pendingResults[ctrl.controlId]?.status === s
                                        ? s === 'pass' ? 'bg-green-500 text-white' : s === 'fail' ? 'bg-red-500 text-white' : 'bg-slate-500 text-white'
                                        : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                                    }`}
                                  >
                                    {s.toUpperCase()}
                                  </button>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                        {ass.status !== 'completed' && (
                          <div className="mt-4 flex justify-end">
                            <button
                              onClick={() => completeAssessment(ass.id)}
                              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-sm"
                            >
                              <CheckCircle className="w-4 h-4" />
                              Complete Assessment
                            </button>
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
    </div>
  );
};

export default ComplianceDashboard;
