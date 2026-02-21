import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Clock, MessageSquare, Send, Download } from 'lucide-react';
import { incidentService, reportService } from '../lib/services';
import type { IncidentDetailResponse } from '../types';
import clsx from 'clsx';

const severityColors: Record<string, string> = {
    critical: 'bg-red-500/20 text-red-400',
    high: 'bg-orange-500/20 text-orange-400',
    medium: 'bg-yellow-500/20 text-yellow-400',
    low: 'bg-blue-500/20 text-blue-400',
};

const IncidentDetail: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [data, setData] = useState<IncidentDetailResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [status, setStatus] = useState('');
    const [assignedTo, setAssignedTo] = useState('');
    const [timelineForm, setTimelineForm] = useState({ action: '', description: '' });

    const fetchData = async () => {
        if (!id) return;
        try {
            const result = await incidentService.getDetail(id);
            setData(result);
            setStatus(result.incident.status);
            setAssignedTo(result.incident.assignedTo || '');
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, [id]);

    const handleUpdate = async () => {
        if (!id) return;
        try {
            await incidentService.update(id, { status, assignedTo: assignedTo || undefined });
            fetchData();
        } catch (err) {
            console.error(err);
        }
    };

    const handleAddTimeline = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!id || !timelineForm.action) return;
        try {
            await incidentService.addTimeline(id, timelineForm);
            setTimelineForm({ action: '', description: '' });
            fetchData();
        } catch (err) {
            console.error(err);
        }
    };

    if (loading) return <div className="p-8 text-slate-400">Loading...</div>;
    if (!data) return <div className="p-8 text-red-400">Incident not found</div>;

    const { incident, timeline } = data;
    const isSlaBreached = incident.slaDeadline && !['resolved', 'closed'].includes(incident.status) && new Date(incident.slaDeadline) < new Date();

    return (
        <div className="space-y-6">
            <button onClick={() => navigate('/incidents')} className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors">
                <ArrowLeft className="w-4 h-4" /> Back to Incidents
            </button>

            {/* Header */}
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-[2px] p-6">
                <div className="flex items-start justify-between mb-4">
                    <div>
                        <h1 className="text-2xl font-bold text-white mb-2">{incident.title}</h1>
                        <div className="flex items-center gap-3">
                            <span className={clsx("px-2 py-0.5 rounded-md text-xs font-medium", severityColors[incident.severity])}>
                                {incident.severity}
                            </span>
                            <span className="text-sm text-slate-400 capitalize">{incident.status}</span>
                            {isSlaBreached && <span className="text-xs font-medium text-red-400 bg-red-500/10 px-2 py-0.5 rounded">SLA BREACHED</span>}
                        </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                        <button
                            onClick={() => id && reportService.downloadIncidentPDF(id)}
                            className="flex items-center gap-2 px-3 py-1.5 bg-white hover:bg-[#E0E0E0] text-black rounded-[2px] text-sm transition-colors"
                        >
                            <Download className="w-4 h-4" /> Download PDF
                        </button>
                    <div className="text-right text-sm text-slate-400">
                        <div>Created: {new Date(incident.createdAt).toLocaleString()}</div>
                        {incident.slaDeadline && <div className="flex items-center gap-1 justify-end mt-1"><Clock className="w-3 h-3" /> SLA: {new Date(incident.slaDeadline).toLocaleString()}</div>}
                    </div>
                    </div>
                </div>
                {incident.description && <p className="text-slate-300 mb-4">{incident.description}</p>}

                {/* Update Controls */}
                <div className="flex gap-4 items-end pt-4 border-t border-slate-700/50">
                    <div>
                        <label className="text-xs text-slate-400">Status</label>
                        <select value={status} onChange={e => setStatus(e.target.value)} className="block mt-1 bg-slate-900 border border-slate-700 rounded-[2px] px-3 py-1.5 text-white text-sm">
                            {['open', 'investigating', 'contained', 'resolved', 'closed'].map(s => (
                                <option key={s} value={s}>{s}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="text-xs text-slate-400">Assigned To</label>
                        <input value={assignedTo} onChange={e => setAssignedTo(e.target.value)} className="block mt-1 bg-slate-900 border border-slate-700 rounded-[2px] px-3 py-1.5 text-white text-sm" />
                    </div>
                    <button onClick={handleUpdate} className="px-4 py-1.5 bg-white hover:bg-[#E0E0E0] text-black rounded-[2px] text-sm transition-colors">Update</button>
                </div>
            </div>

            {/* Timeline */}
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-[2px] p-6">
                <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2"><MessageSquare className="w-5 h-5" /> Timeline</h2>

                {/* Add Entry */}
                <form onSubmit={handleAddTimeline} className="flex gap-3 mb-6">
                    <input value={timelineForm.action} onChange={e => setTimelineForm({ ...timelineForm, action: e.target.value })} placeholder="Action (e.g., Note, Escalation)" className="bg-slate-900 border border-slate-700 rounded-[2px] px-3 py-2 text-white text-sm flex-shrink-0 w-44" />
                    <input value={timelineForm.description} onChange={e => setTimelineForm({ ...timelineForm, description: e.target.value })} placeholder="Description..." className="bg-slate-900 border border-slate-700 rounded-[2px] px-3 py-2 text-white text-sm flex-1" />
                    <button type="submit" className="p-2 bg-white hover:bg-[#E0E0E0] text-black rounded-[2px] transition-colors"><Send className="w-4 h-4" /></button>
                </form>

                {/* Entries */}
                <div className="space-y-4">
                    {timeline.map(entry => (
                        <div key={entry.id} className="flex gap-3">
                            <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs text-white font-bold flex-shrink-0">
                                {entry.performedBy?.charAt(0)?.toUpperCase() || 'S'}
                            </div>
                            <div className="flex-1">
                                <div className="flex items-center gap-2 mb-0.5">
                                    <span className="text-sm font-medium text-white">{entry.action}</span>
                                    <span className="text-xs text-slate-500">by {entry.performedBy}</span>
                                    <span className="text-xs text-slate-600">{new Date(entry.createdAt).toLocaleString()}</span>
                                </div>
                                <p className="text-sm text-slate-400">{entry.description}</p>
                            </div>
                        </div>
                    ))}
                    {timeline.length === 0 && <p className="text-sm text-slate-500">No timeline entries yet.</p>}
                </div>
            </div>
        </div>
    );
};

export default IncidentDetail;
