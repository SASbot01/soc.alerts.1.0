import React, { useEffect, useState, useCallback } from 'react';
import {
  Cpu, Plus, Pencil, Trash2, RefreshCw, X, Check,
  ToggleLeft, ToggleRight, Activity, AlertTriangle
} from 'lucide-react';
import api from '../lib/api';

interface CepRule {
  id: string;
  name: string;
  description: string | null;
  ruleType: string;
  conditions: unknown;
  actions: unknown;
  windowSeconds: number;
  threshold: number;
  isEnabled: boolean;
  hitCount: number;
  lastHitAt: string | null;
  companyId: string;
}

interface CepStats {
  totalRules: number;
  enabledRules: number;
  totalHits: number;
}

const RULE_TYPES = ['threshold', 'sequence', 'absence', 'pattern'];

const ruleTypeBadge = (type: string) => {
  const map: Record<string, string> = {
    threshold: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    sequence: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    absence: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    pattern: 'bg-green-500/10 text-green-400 border-green-500/20',
  };
  return `border ${map[type] ?? 'bg-slate-700/50 text-slate-300 border-slate-600'}`;
};

const fmt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' }) : 'Never';

const jsonPlaceholder = (type: 'conditions' | 'actions') =>
  type === 'conditions'
    ? '{\n  "field": "event_type",\n  "operator": "equals",\n  "value": "login_failure"\n}'
    : '[\n  { "type": "alert", "severity": "high" }\n]';

interface RuleFormData {
  name: string;
  description: string;
  ruleType: string;
  conditionsRaw: string;
  actionsRaw: string;
  windowSeconds: string;
  threshold: string;
}

const emptyForm = (): RuleFormData => ({
  name: '',
  description: '',
  ruleType: 'threshold',
  conditionsRaw: '',
  actionsRaw: '',
  windowSeconds: '60',
  threshold: '5',
});

const CepRules: React.FC = () => {
  const companyId = (JSON.parse(localStorage.getItem('user') || '{}') as { companyId?: string }).companyId;

  const [rules, setRules] = useState<CepRule[]>([]);
  const [stats, setStats] = useState<CepStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingRule, setEditingRule] = useState<CepRule | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const [form, setForm] = useState<RuleFormData>(emptyForm());
  const [formError, setFormError] = useState('');
  const [formLoading, setFormLoading] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [rr, sr] = await Promise.all([
        api.get('/cep/rules', { params: { companyId } }),
        api.get('/cep/stats', { params: { companyId } }),
      ]);
      setRules(Array.isArray(rr.data) ? rr.data : rr.data.rules ?? rr.data.content ?? []);
      setStats(sr.data);
    } catch (e) {
      console.error('Failed to load CEP rules', e);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => { loadData(); }, [loadData]);

  const parseJsonField = (raw: string, fieldName: string): unknown => {
    if (!raw.trim()) return {};
    try {
      return JSON.parse(raw);
    } catch {
      throw new Error(`Invalid JSON in ${fieldName}.`);
    }
  };

  const buildPayload = (f: RuleFormData) => {
    const conditions = parseJsonField(f.conditionsRaw, 'Conditions');
    const actions = parseJsonField(f.actionsRaw, 'Actions');
    return {
      name: f.name.trim(),
      description: f.description.trim() || null,
      ruleType: f.ruleType,
      conditions,
      actions,
      windowSeconds: parseInt(f.windowSeconds, 10) || 60,
      threshold: parseInt(f.threshold, 10) || 1,
      companyId,
    };
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!form.name.trim()) { setFormError('Name is required.'); return; }
    setFormLoading(true);
    try {
      const payload = buildPayload(form);
      await api.post('/cep/rules', payload);
      setForm(emptyForm());
      setShowCreateForm(false);
      await loadData();
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : 'Failed to create rule.');
    } finally {
      setFormLoading(false);
    }
  };

  const startEdit = (rule: CepRule) => {
    setEditingRule(rule);
    setForm({
      name: rule.name,
      description: rule.description ?? '',
      ruleType: rule.ruleType,
      conditionsRaw: rule.conditions ? JSON.stringify(rule.conditions, null, 2) : '',
      actionsRaw: rule.actions ? JSON.stringify(rule.actions, null, 2) : '',
      windowSeconds: String(rule.windowSeconds),
      threshold: String(rule.threshold),
    });
    setFormError('');
    setShowCreateForm(false);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRule) return;
    setFormError('');
    if (!form.name.trim()) { setFormError('Name is required.'); return; }
    setFormLoading(true);
    try {
      const payload = buildPayload(form);
      await api.put(`/cep/rules/${editingRule.id}`, payload);
      setEditingRule(null);
      setForm(emptyForm());
      await loadData();
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : 'Failed to update rule.');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    setActionLoading(id);
    try {
      await api.delete(`/cep/rules/${id}`);
      setConfirmDelete(null);
      await loadData();
    } catch (e) {
      console.error('Failed to delete rule', e);
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleEnabled = async (rule: CepRule) => {
    setActionLoading(rule.id);
    try {
      await api.put(`/cep/rules/${rule.id}`, {
        ...rule,
        isEnabled: !rule.isEnabled,
        companyId,
        conditions: rule.conditions ?? {},
        actions: rule.actions ?? [],
      });
      await loadData();
    } catch (e) {
      console.error('Failed to toggle rule', e);
    } finally {
      setActionLoading(null);
    }
  };

  const cancelForm = () => {
    setShowCreateForm(false);
    setEditingRule(null);
    setForm(emptyForm());
    setFormError('');
  };

  const RuleForm: React.FC<{ onSubmit: (e: React.FormEvent) => void; submitLabel: string }> = ({ onSubmit, submitLabel }) => (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-slate-400 mb-1">Name <span className="text-red-400">*</span></label>
          <input
            type="text"
            placeholder="e.g. Brute Force Detection"
            value={form.name}
            onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
            className="w-full bg-slate-800 border border-slate-600 rounded-md px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Rule Type</label>
          <select
            value={form.ruleType}
            onChange={e => setForm(p => ({ ...p, ruleType: e.target.value }))}
            className="w-full bg-slate-800 border border-slate-600 rounded-md px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
          >
            {RULE_TYPES.map(t => (
              <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs text-slate-400 mb-1">Description</label>
          <input
            type="text"
            placeholder="Optional description..."
            value={form.description}
            onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
            className="w-full bg-slate-800 border border-slate-600 rounded-md px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Window (seconds)</label>
          <input
            type="number"
            min={1}
            value={form.windowSeconds}
            onChange={e => setForm(p => ({ ...p, windowSeconds: e.target.value }))}
            className="w-full bg-slate-800 border border-slate-600 rounded-md px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Threshold</label>
          <input
            type="number"
            min={1}
            value={form.threshold}
            onChange={e => setForm(p => ({ ...p, threshold: e.target.value }))}
            className="w-full bg-slate-800 border border-slate-600 rounded-md px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Conditions (JSON)</label>
          <textarea
            rows={6}
            placeholder={jsonPlaceholder('conditions')}
            value={form.conditionsRaw}
            onChange={e => setForm(p => ({ ...p, conditionsRaw: e.target.value }))}
            className="w-full bg-slate-800 border border-slate-600 rounded-md px-3 py-2 text-xs text-slate-200 font-mono placeholder-slate-600 focus:outline-none focus:border-blue-500 resize-none"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Actions (JSON)</label>
          <textarea
            rows={6}
            placeholder={jsonPlaceholder('actions')}
            value={form.actionsRaw}
            onChange={e => setForm(p => ({ ...p, actionsRaw: e.target.value }))}
            className="w-full bg-slate-800 border border-slate-600 rounded-md px-3 py-2 text-xs text-slate-200 font-mono placeholder-slate-600 focus:outline-none focus:border-blue-500 resize-none"
          />
        </div>
      </div>
      {formError && (
        <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded px-3 py-2">
          {formError}
        </div>
      )}
      <div className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={cancelForm}
          className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-300 text-sm transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={formLoading}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-white text-sm font-medium transition-colors disabled:opacity-50"
        >
          {formLoading ? 'Saving...' : submitLabel}
        </button>
      </div>
    </form>
  );

  const statCards = [
    { label: 'Total Rules', value: stats?.totalRules ?? 0, color: 'text-white', icon: <Cpu className="w-5 h-5 text-blue-400" /> },
    { label: 'Enabled Rules', value: stats?.enabledRules ?? 0, color: 'text-green-400', icon: <Activity className="w-5 h-5 text-green-400" /> },
    { label: 'Total Hits', value: stats?.totalHits ?? 0, color: 'text-orange-400', icon: <AlertTriangle className="w-5 h-5 text-orange-400" /> },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Cpu className="w-7 h-7 text-blue-400" />
            Complex Event Processing Rules
          </h1>
          <p className="text-slate-400 text-sm mt-1">Define and manage real-time event correlation and detection rules</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            className="flex items-center gap-2 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-300 hover:text-white hover:border-slate-500 transition-colors text-sm"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          {!editingRule && (
            <button
              onClick={() => { setShowCreateForm(v => !v); setEditingRule(null); setForm(emptyForm()); setFormError(''); }}
              className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-white transition-colors text-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              New Rule
            </button>
          )}
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

      {/* Create Form */}
      {showCreateForm && !editingRule && (
        <div className="bg-slate-900 border border-blue-500/30 rounded-lg p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <Plus className="w-4 h-4 text-blue-400" />
              Create Rule
            </h2>
            <button onClick={cancelForm} className="text-slate-500 hover:text-slate-300">
              <X className="w-4 h-4" />
            </button>
          </div>
          <RuleForm onSubmit={handleCreate} submitLabel="Create Rule" />
        </div>
      )}

      {/* Edit Form */}
      {editingRule && (
        <div className="bg-slate-900 border border-amber-500/30 rounded-lg p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <Pencil className="w-4 h-4 text-amber-400" />
              Edit Rule: <span className="text-amber-300">{editingRule.name}</span>
            </h2>
            <button onClick={cancelForm} className="text-slate-500 hover:text-slate-300">
              <X className="w-4 h-4" />
            </button>
          </div>
          <RuleForm onSubmit={handleUpdate} submitLabel="Save Changes" />
        </div>
      )}

      {/* Rules Table */}
      <div className="bg-slate-900 border border-slate-700 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-200">Rules</h2>
          <span className="text-xs text-slate-500">{rules.length} rule{rules.length !== 1 ? 's' : ''}</span>
        </div>
        {loading ? (
          <div className="flex items-center justify-center h-40 text-slate-400 text-sm">Loading rules...</div>
        ) : rules.length === 0 ? (
          <div className="flex items-center justify-center h-40 text-slate-500 text-sm">No rules yet. Create one above.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-slate-400 border-b border-slate-700">
                  <th className="px-4 py-3 text-left font-medium">Name</th>
                  <th className="px-4 py-3 text-left font-medium">Type</th>
                  <th className="px-4 py-3 text-left font-medium">Window</th>
                  <th className="px-4 py-3 text-left font-medium">Threshold</th>
                  <th className="px-4 py-3 text-left font-medium">Enabled</th>
                  <th className="px-4 py-3 text-left font-medium">Hits</th>
                  <th className="px-4 py-3 text-left font-medium">Last Hit</th>
                  <th className="px-4 py-3 text-left font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {rules.map(rule => (
                  <tr
                    key={rule.id}
                    className={`hover:bg-slate-800/40 transition-colors ${editingRule?.id === rule.id ? 'bg-amber-500/5' : ''}`}
                  >
                    <td className="px-4 py-3">
                      <div className="text-slate-200 font-medium text-sm">{rule.name}</div>
                      {rule.description && (
                        <div className="text-slate-500 text-xs mt-0.5 max-w-xs truncate" title={rule.description}>
                          {rule.description}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${ruleTypeBadge(rule.ruleType)}`}>
                        {rule.ruleType}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-300 text-xs font-mono">{rule.windowSeconds}s</td>
                    <td className="px-4 py-3 text-slate-300 text-xs font-mono">{rule.threshold}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleToggleEnabled(rule)}
                        disabled={actionLoading === rule.id}
                        className="flex items-center gap-1.5 text-xs transition-colors disabled:opacity-50"
                        title={rule.isEnabled ? 'Click to disable' : 'Click to enable'}
                      >
                        {rule.isEnabled
                          ? <ToggleRight className="w-5 h-5 text-green-400" />
                          : <ToggleLeft className="w-5 h-5 text-slate-500" />}
                        <span className={rule.isEnabled ? 'text-green-400' : 'text-slate-500'}>
                          {rule.isEnabled ? 'On' : 'Off'}
                        </span>
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-sm font-bold ${rule.hitCount > 0 ? 'text-orange-400' : 'text-slate-500'}`}>
                        {rule.hitCount.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">{fmt(rule.lastHitAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => startEdit(rule)}
                          className="p-1.5 rounded bg-slate-800 border border-slate-700 text-slate-400 hover:text-amber-400 hover:border-amber-500/50 transition-colors"
                          title="Edit rule"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        {confirmDelete === rule.id ? (
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-slate-400">Delete?</span>
                            <button
                              onClick={() => handleDelete(rule.id)}
                              disabled={actionLoading === rule.id}
                              className="p-1 rounded bg-red-600 hover:bg-red-500 text-white disabled:opacity-50"
                              title="Confirm delete"
                            >
                              <Check className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => setConfirmDelete(null)}
                              className="p-1 rounded bg-slate-700 hover:bg-slate-600 text-slate-300"
                              title="Cancel"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmDelete(rule.id)}
                            className="p-1.5 rounded bg-slate-800 border border-slate-700 text-slate-400 hover:text-red-400 hover:border-red-500/50 transition-colors"
                            title="Delete rule"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default CepRules;
