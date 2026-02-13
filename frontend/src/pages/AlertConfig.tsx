import React, { useEffect, useState } from 'react';
import { Bell, Plus, Trash2, Mail, MessageSquare, Globe, History } from 'lucide-react';
import { alertService } from '../lib/services';
import type { AlertConfiguration, AlertHistory } from '../types';
import clsx from 'clsx';

const typeIcons: Record<string, React.ReactNode> = {
    email: <Mail className="w-4 h-4" />,
    slack: <MessageSquare className="w-4 h-4" />,
    webhook: <Globe className="w-4 h-4" />,
};

const AlertConfig: React.FC = () => {
    const [configs, setConfigs] = useState<AlertConfiguration[]>([]);
    const [history, setHistory] = useState<AlertHistory[]>([]);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState<'config' | 'history'>('config');
    const [showCreate, setShowCreate] = useState(false);
    const [form, setForm] = useState({ alertType: 'email', destination: '', minSeverity: 7 });

    const fetchData = async () => {
        try {
            const [c, h] = await Promise.all([alertService.listConfigs(), alertService.getHistory()]);
            setConfigs(c);
            setHistory(h);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await alertService.createConfig(form);
            setShowCreate(false);
            setForm({ alertType: 'email', destination: '', minSeverity: 7 });
            fetchData();
        } catch (err) {
            console.error(err);
        }
    };

    const handleToggle = async (config: AlertConfiguration) => {
        try {
            await alertService.updateConfig(config.id, { isActive: !config.active });
            fetchData();
        } catch (err) {
            console.error(err);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this alert configuration?')) return;
        try {
            await alertService.deleteConfig(id);
            fetchData();
        } catch (err) {
            console.error(err);
        }
    };

    if (loading) return <div className="p-8 text-slate-400">Loading alerts...</div>;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white mb-1">Alert Configuration</h1>
                    <p className="text-slate-400">Configure notification channels for security events</p>
                </div>
                <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-[#E0E0E0] text-black rounded-[2px] transition-colors">
                    <Plus className="w-4 h-4" /> Add Channel
                </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-2">
                <button onClick={() => setTab('config')} className={clsx("flex items-center gap-2 px-4 py-2 rounded-[2px] text-sm font-medium transition-colors", tab === 'config' ? "bg-primary-500/20 text-primary-400" : "text-slate-400 hover:bg-slate-800")}>
                    <Bell className="w-4 h-4" /> Configurations ({configs.length})
                </button>
                <button onClick={() => setTab('history')} className={clsx("flex items-center gap-2 px-4 py-2 rounded-[2px] text-sm font-medium transition-colors", tab === 'history' ? "bg-primary-500/20 text-primary-400" : "text-slate-400 hover:bg-slate-800")}>
                    <History className="w-4 h-4" /> History ({history.length})
                </button>
            </div>

            {tab === 'config' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {configs.map(config => (
                        <div key={config.id} className="bg-slate-800/50 border border-slate-700/50 rounded-[2px] p-4">
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2 text-white font-medium capitalize">
                                    {typeIcons[config.alertType]} {config.alertType}
                                </div>
                                <div className="flex items-center gap-2">
                                    <button onClick={() => handleToggle(config)} className={clsx("w-10 h-5 rounded-full transition-colors relative", config.active ? "bg-green-500" : "bg-slate-600")}>
                                        <div className={clsx("w-4 h-4 bg-white rounded-full absolute top-0.5 transition-all", config.active ? "left-5.5" : "left-0.5")} style={{ left: config.active ? '22px' : '2px' }} />
                                    </button>
                                    <button onClick={() => handleDelete(config.id)} className="text-slate-500 hover:text-red-400 transition-colors"><Trash2 className="w-4 h-4" /></button>
                                </div>
                            </div>
                            <div className="text-sm text-slate-400 break-all mb-2">{config.destination}</div>
                            <div className="text-xs text-slate-500">Min severity: {config.minSeverity}/10</div>
                        </div>
                    ))}
                    {configs.length === 0 && <div className="col-span-full text-center py-8 text-slate-500">No alert configurations. Add a channel to get started.</div>}
                </div>
            )}

            {tab === 'history' && (
                <div className="bg-slate-800/50 border border-slate-700/50 rounded-[2px] overflow-hidden">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-slate-700/50">
                                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Type</th>
                                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Subject</th>
                                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Destination</th>
                                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Status</th>
                                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Sent</th>
                            </tr>
                        </thead>
                        <tbody>
                            {history.map(h => (
                                <tr key={h.id} className="border-b border-slate-700/30">
                                    <td className="px-4 py-3 capitalize text-sm text-slate-300">{h.alertType}</td>
                                    <td className="px-4 py-3 text-sm text-white max-w-xs truncate">{h.subject}</td>
                                    <td className="px-4 py-3 text-sm text-slate-400 max-w-xs truncate">{h.destination}</td>
                                    <td className="px-4 py-3">
                                        <span className={clsx("text-xs font-medium px-2 py-0.5 rounded", h.status === 'sent' ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400")}>{h.status}</span>
                                    </td>
                                    <td className="px-4 py-3 text-sm text-slate-400">{new Date(h.sentAt).toLocaleString()}</td>
                                </tr>
                            ))}
                            {history.length === 0 && (
                                <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">No alert history yet</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Create Modal */}
            {showCreate && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setShowCreate(false)}>
                    <div className="bg-slate-900 border border-slate-700 rounded-[2px] p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
                        <h2 className="text-xl font-bold text-white mb-4">Add Alert Channel</h2>
                        <form onSubmit={handleCreate} className="space-y-4">
                            <div>
                                <label className="text-sm text-slate-300">Channel Type</label>
                                <select value={form.alertType} onChange={e => setForm({ ...form, alertType: e.target.value })} className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-[2px] px-3 py-2 text-white">
                                    <option value="email">Email</option>
                                    <option value="slack">Slack Webhook</option>
                                    <option value="webhook">Custom Webhook</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-sm text-slate-300">Destination</label>
                                <input value={form.destination} onChange={e => setForm({ ...form, destination: e.target.value })} required className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-[2px] px-3 py-2 text-white" placeholder={form.alertType === 'email' ? 'alert@company.com' : 'https://hooks.slack.com/...'} />
                            </div>
                            <div>
                                <label className="text-sm text-slate-300">Minimum Severity (1-10)</label>
                                <input type="number" min={1} max={10} value={form.minSeverity} onChange={e => setForm({ ...form, minSeverity: parseInt(e.target.value) })} className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-[2px] px-3 py-2 text-white" />
                            </div>
                            <div className="flex justify-end gap-3 pt-2">
                                <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 text-slate-400 hover:text-white transition-colors">Cancel</button>
                                <button type="submit" className="px-4 py-2 bg-white hover:bg-[#E0E0E0] text-black rounded-[2px] transition-colors">Create</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AlertConfig;
