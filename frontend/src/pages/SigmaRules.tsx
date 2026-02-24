import React, { useEffect, useState } from 'react';
import { Plus, Edit2, Trash2, ToggleLeft, ToggleRight, FileCode, Shield, BarChart3 } from 'lucide-react';
import api from '../lib/api';

interface SigmaRule {
  id: string;
  companyId: string | null;
  title: string;
  description: string;
  status: string;
  level: string;
  ruleYaml: string;
  logsourceCategory: string;
  logsourceProduct: string;
  tags: string;
  mitreTechniques: string;
  author: string;
  isEnabled: boolean;
  matchCount: number;
  lastMatchAt: string | null;
  source: string;
  createdAt: string;
}

const sigmaService = {
  list: () => api.get('/sigma').then(r => r.data),
  listGlobal: () => api.get('/sigma/global').then(r => r.data),
  create: (data: any) => api.post('/sigma', data).then(r => r.data),
  update: (id: string, data: any) => api.put(`/sigma/${id}`, data).then(r => r.data),
  delete: (id: string) => api.delete(`/sigma/${id}`).then(r => r.data),
  toggle: (id: string) => api.post(`/sigma/${id}/toggle`).then(r => r.data),
  stats: () => api.get('/sigma/stats').then(r => r.data),
};

const levelColors: Record<string, string> = {
  critical: 'text-red-400 bg-red-500/10 border-red-500/20',
  high: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
  medium: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  low: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  informational: 'text-slate-400 bg-slate-500/10 border-slate-500/20',
};

const SigmaRules: React.FC = () => {
  const [rules, setRules] = useState<SigmaRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [editingRule, setEditingRule] = useState<SigmaRule | null>(null);
  const [form, setForm] = useState({
    title: '',
    description: '',
    ruleYaml: '',
    level: 'medium',
    status: 'experimental',
    tags: '',
    mitreTechniques: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [rulesData, statsData] = await Promise.all([
        sigmaService.list(),
        sigmaService.stats(),
      ]);
      setRules(rulesData);
      setStats(statsData);
    } catch (err) {
      console.error('Failed to load SIGMA rules:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      if (editingRule) {
        await sigmaService.update(editingRule.id, form);
      } else {
        await sigmaService.create(form);
      }
      setShowEditor(false);
      setEditingRule(null);
      setForm({ title: '', description: '', ruleYaml: '', level: 'medium', status: 'experimental', tags: '', mitreTechniques: '' });
      loadData();
    } catch (err) {
      console.error('Failed to save rule:', err);
    }
  };

  const handleEdit = (rule: SigmaRule) => {
    setEditingRule(rule);
    setForm({
      title: rule.title,
      description: rule.description || '',
      ruleYaml: rule.ruleYaml || '',
      level: rule.level,
      status: rule.status,
      tags: rule.tags || '',
      mitreTechniques: rule.mitreTechniques || '',
    });
    setShowEditor(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await sigmaService.delete(id);
      loadData();
    } catch (err) {
      console.error('Failed to delete rule:', err);
    }
  };

  const handleToggle = async (id: string) => {
    try {
      await sigmaService.toggle(id);
      loadData();
    } catch (err) {
      console.error('Failed to toggle rule:', err);
    }
  };

  const defaultYaml = `title: My Custom Rule
status: experimental
level: medium
logsource:
    category: network
    product: suricata
detection:
    selection:
        threat_type: port_scan
        severity: 5
    condition: selection
falsepositives:
    - Internal vulnerability scanners`;

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-slate-400">Loading SIGMA rules...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <FileCode className="w-7 h-7 text-primary-400" />
            SIGMA Rules
          </h1>
          <p className="text-slate-400 text-sm mt-1">Detection rules in SIGMA format for automated threat detection</p>
        </div>
        <button
          onClick={() => {
            setEditingRule(null);
            setForm({ title: '', description: '', ruleYaml: defaultYaml, level: 'medium', status: 'experimental', tags: '', mitreTechniques: '' });
            setShowEditor(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700 transition"
        >
          <Plus className="w-4 h-4" />
          New Rule
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Custom Rules', value: stats.customRules, icon: FileCode },
            { label: 'Global Rules', value: stats.globalRules, icon: Shield },
            { label: 'Enabled', value: stats.enabledRules, icon: ToggleRight },
            { label: 'Total Matches', value: stats.totalMatches, icon: BarChart3 },
          ].map(s => (
            <div key={s.label} className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
              <div className="flex items-center gap-2 text-slate-400 text-sm">
                <s.icon className="w-4 h-4" />
                {s.label}
              </div>
              <div className="text-2xl font-bold text-white mt-1">{s.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Rules List */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="text-xs text-slate-400 uppercase tracking-wider border-b border-slate-700">
              <th className="text-left p-3">Status</th>
              <th className="text-left p-3">Title</th>
              <th className="text-left p-3">Level</th>
              <th className="text-left p-3">Source</th>
              <th className="text-left p-3">Matches</th>
              <th className="text-left p-3">Last Match</th>
              <th className="text-right p-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {rules.map(rule => (
              <tr key={rule.id} className="hover:bg-slate-800/50 transition">
                <td className="p-3">
                  <button onClick={() => handleToggle(rule.id)}>
                    {rule.isEnabled
                      ? <ToggleRight className="w-5 h-5 text-green-400" />
                      : <ToggleLeft className="w-5 h-5 text-slate-500" />}
                  </button>
                </td>
                <td className="p-3">
                  <div className="text-white font-medium">{rule.title}</div>
                  {rule.tags && (
                    <div className="flex gap-1 mt-1">
                      {rule.tags.split(',').slice(0, 3).map(t => (
                        <span key={t} className="text-xs px-1.5 py-0.5 bg-slate-700 rounded text-slate-400">{t.trim()}</span>
                      ))}
                    </div>
                  )}
                </td>
                <td className="p-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium border ${levelColors[rule.level] || levelColors.medium}`}>
                    {rule.level}
                  </span>
                </td>
                <td className="p-3 text-sm text-slate-400">{rule.source}</td>
                <td className="p-3 text-sm text-white font-mono">{rule.matchCount}</td>
                <td className="p-3 text-sm text-slate-400">
                  {rule.lastMatchAt ? new Date(rule.lastMatchAt).toLocaleString() : '-'}
                </td>
                <td className="p-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={() => handleEdit(rule)} className="p-1.5 text-slate-400 hover:text-white transition">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(rule.id)} className="p-1.5 text-slate-400 hover:text-red-400 transition">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rules.length === 0 && (
          <div className="p-8 text-center text-slate-500">No SIGMA rules yet. Click "New Rule" to create one.</div>
        )}
      </div>

      {/* Editor Modal */}
      {showEditor && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-lg w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 space-y-4">
              <h3 className="text-white font-bold text-lg">
                {editingRule ? 'Edit SIGMA Rule' : 'New SIGMA Rule'}
              </h3>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Title</label>
                  <input
                    type="text"
                    value={form.title}
                    onChange={e => setForm({ ...form, title: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-white focus:border-primary-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Level</label>
                  <select
                    value={form.level}
                    onChange={e => setForm({ ...form, level: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-white focus:border-primary-500 focus:outline-none"
                  >
                    <option value="informational">Informational</option>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Description</label>
                <input
                  type="text"
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-white focus:border-primary-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Rule YAML</label>
                <textarea
                  value={form.ruleYaml}
                  onChange={e => setForm({ ...form, ruleYaml: e.target.value })}
                  rows={14}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-white font-mono text-sm focus:border-primary-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Tags (comma-separated)</label>
                  <input
                    type="text"
                    value={form.tags}
                    onChange={e => setForm({ ...form, tags: e.target.value })}
                    placeholder="attack.t1059, network"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-white focus:border-primary-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">MITRE Techniques</label>
                  <input
                    type="text"
                    value={form.mitreTechniques}
                    onChange={e => setForm({ ...form, mitreTechniques: e.target.value })}
                    placeholder="T1059, T1053"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-white focus:border-primary-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => { setShowEditor(false); setEditingRule(null); }}
                  className="px-4 py-2 text-slate-400 hover:text-white transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  className="px-6 py-2 bg-primary-600 text-white rounded hover:bg-primary-700 transition font-medium"
                >
                  {editingRule ? 'Update' : 'Create'} Rule
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SigmaRules;
