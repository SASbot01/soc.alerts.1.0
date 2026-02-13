import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Plus, Clock, CheckCircle2, XCircle } from 'lucide-react';
import { incidentService } from '../lib/services';
import type { Incident } from '../types';
import clsx from 'clsx';

const severityColors: Record<string, string> = {
    critical: 'bg-red-500/20 text-red-400 border-red-500/30',
    high: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    low: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
};

const statusIcons: Record<string, React.ReactNode> = {
    open: <AlertTriangle className="w-4 h-4 text-red-400" />,
    investigating: <Clock className="w-4 h-4 text-yellow-400" />,
    contained: <Clock className="w-4 h-4 text-blue-400" />,
    resolved: <CheckCircle2 className="w-4 h-4 text-green-400" />,
    closed: <XCircle className="w-4 h-4 text-slate-400" />,
};

const Incidents: React.FC = () => {
    const [incidents, setIncidents] = useState<Incident[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all');
    const [showCreate, setShowCreate] = useState(false);
    const [form, setForm] = useState({ title: '', description: '', severity: 'medium', assignedTo: '' });
    const navigate = useNavigate();

    const fetchIncidents = async () => {
        try {
            const data = await incidentService.list();
            setIncidents(data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchIncidents(); }, []);

    const filtered = filter === 'all' ? incidents : incidents.filter(i => i.status === filter);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await incidentService.create(form);
            setShowCreate(false);
            setForm({ title: '', description: '', severity: 'medium', assignedTo: '' });
            fetchIncidents();
        } catch (err) {
            console.error(err);
        }
    };

    const isSlaBreached = (incident: Incident) => {
        if (!incident.slaDeadline || incident.status === 'resolved' || incident.status === 'closed') return false;
        return new Date(incident.slaDeadline) < new Date();
    };

    if (loading) return <div className="p-8 text-slate-400">Loading incidents...</div>;

    const openCount = incidents.filter(i => i.status === 'open').length;
    const criticalCount = incidents.filter(i => i.severity === 'critical' && i.status !== 'resolved' && i.status !== 'closed').length;
    const breachedCount = incidents.filter(isSlaBreached).length;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white mb-1">Incidents</h1>
                    <p className="text-slate-400">Security incident management and response tracking</p>
                </div>
                <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-[#E0E0E0] text-black rounded-[2px] transition-colors">
                    <Plus className="w-4 h-4" /> New Incident
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {[
                    { label: 'Total', value: incidents.length, color: 'text-white' },
                    { label: 'Open', value: openCount, color: 'text-red-400' },
                    { label: 'Critical', value: criticalCount, color: 'text-orange-400' },
                    { label: 'SLA Breached', value: breachedCount, color: 'text-red-500' },
                ].map((s, i) => (
                    <div key={i} className="bg-slate-800/50 border border-slate-700/50 rounded-[2px] p-4">
                        <div className={clsx("text-2xl font-bold", s.color)}>{s.value}</div>
                        <div className="text-sm text-slate-400">{s.label}</div>
                    </div>
                ))}
            </div>

            {/* Filters */}
            <div className="flex gap-2">
                {['all', 'open', 'investigating', 'contained', 'resolved', 'closed'].map(f => (
                    <button key={f} onClick={() => setFilter(f)} className={clsx(
                        "px-3 py-1.5 rounded-[2px] text-sm font-medium transition-colors capitalize",
                        filter === f ? "bg-primary-500/20 text-primary-400 border border-primary-500/30" : "text-slate-400 hover:bg-slate-800"
                    )}>{f}</button>
                ))}
            </div>

            {/* Table */}
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-[2px] overflow-hidden">
                <table className="w-full">
                    <thead>
                        <tr className="border-b border-slate-700/50">
                            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Title</th>
                            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Severity</th>
                            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Status</th>
                            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Assigned</th>
                            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase">SLA</th>
                            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Created</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.map(inc => (
                            <tr key={inc.id} onClick={() => navigate(`/incidents/${inc.id}`)} className="border-b border-slate-700/30 hover:bg-slate-800/70 cursor-pointer transition-colors">
                                <td className="px-4 py-3 text-white font-medium">{inc.title}</td>
                                <td className="px-4 py-3">
                                    <span className={clsx("px-2 py-0.5 rounded-md text-xs font-medium border", severityColors[inc.severity] || 'text-slate-400')}>
                                        {inc.severity}
                                    </span>
                                </td>
                                <td className="px-4 py-3">
                                    <div className="flex items-center gap-1.5">
                                        {statusIcons[inc.status]}
                                        <span className="text-sm text-slate-300 capitalize">{inc.status}</span>
                                    </div>
                                </td>
                                <td className="px-4 py-3 text-sm text-slate-400">{inc.assignedTo || '-'}</td>
                                <td className="px-4 py-3">
                                    {isSlaBreached(inc) ? (
                                        <span className="text-xs font-medium text-red-400 bg-red-500/10 px-2 py-0.5 rounded">BREACHED</span>
                                    ) : inc.slaDeadline ? (
                                        <span className="text-xs text-slate-400">{new Date(inc.slaDeadline).toLocaleString()}</span>
                                    ) : '-'}
                                </td>
                                <td className="px-4 py-3 text-sm text-slate-400">{new Date(inc.createdAt).toLocaleString()}</td>
                            </tr>
                        ))}
                        {filtered.length === 0 && (
                            <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">No incidents found</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Create Modal */}
            {showCreate && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setShowCreate(false)}>
                    <div className="bg-slate-900 border border-slate-700 rounded-[2px] p-6 w-full max-w-lg" onClick={e => e.stopPropagation()}>
                        <h2 className="text-xl font-bold text-white mb-4">Create Incident</h2>
                        <form onSubmit={handleCreate} className="space-y-4">
                            <div>
                                <label className="text-sm text-slate-300">Title</label>
                                <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-[2px] px-3 py-2 text-white" />
                            </div>
                            <div>
                                <label className="text-sm text-slate-300">Description</label>
                                <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={3} className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-[2px] px-3 py-2 text-white" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-sm text-slate-300">Severity</label>
                                    <select value={form.severity} onChange={e => setForm({ ...form, severity: e.target.value })} className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-[2px] px-3 py-2 text-white">
                                        <option value="critical">Critical</option>
                                        <option value="high">High</option>
                                        <option value="medium">Medium</option>
                                        <option value="low">Low</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-sm text-slate-300">Assigned To</label>
                                    <input value={form.assignedTo} onChange={e => setForm({ ...form, assignedTo: e.target.value })} className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-[2px] px-3 py-2 text-white" placeholder="analyst@company.com" />
                                </div>
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

export default Incidents;
