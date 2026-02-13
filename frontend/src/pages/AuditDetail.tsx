import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, ChevronRight } from 'lucide-react';
import { auditService } from '../lib/services';
import type { AuditDetailResponse, ActivityLog } from '../types';
import StatusTimeline from '../components/StatusTimeline';
import StatusBadge from '../components/StatusBadge';
import SeverityBadge from '../components/SeverityBadge';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';

const AUDIT_STEPS = ['SCOPING', 'SCANNING', 'TESTING', 'REPORTING', 'DELIVERED'];

const AuditDetail: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [audit, setAudit] = useState<AuditDetailResponse | null>(null);
    const [activity, setActivity] = useState<ActivityLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAddFinding, setShowAddFinding] = useState(false);
    const [showAdvance, setShowAdvance] = useState(false);
    const [findingForm, setFindingForm] = useState({ title: '', description: '', riskLevel: 'MEDIUM', cvssScore: 5.0, affectedAsset: '', recommendation: '' });

    const fetchData = async () => {
        if (!id) return;
        setLoading(true);
        try {
            const [auditData, activityData] = await Promise.all([
                auditService.getDetail(id),
                auditService.getActivity(id),
            ]);
            setAudit(auditData);
            setActivity(activityData);
        } catch (err) {
            console.error('Failed to fetch audit detail:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, [id]);

    const handleAdvance = async () => {
        if (!audit || !id) return;
        const currentIdx = AUDIT_STEPS.indexOf(audit.status);
        if (currentIdx >= AUDIT_STEPS.length - 1) return;
        const nextStatus = AUDIT_STEPS[currentIdx + 1];
        try {
            await auditService.updateStatus(id, { status: nextStatus });
            fetchData();
        } catch (err) {
            console.error('Failed to advance status:', err);
        }
    };

    const handleAddFinding = async () => {
        if (!id) return;
        try {
            await auditService.addFinding(id, findingForm);
            setShowAddFinding(false);
            setFindingForm({ title: '', description: '', riskLevel: 'MEDIUM', cvssScore: 5.0, affectedAsset: '', recommendation: '' });
            fetchData();
        } catch (err) {
            console.error('Failed to add finding:', err);
        }
    };

    const handleResolveFinding = async (findingId: string) => {
        try {
            await auditService.updateFindingStatus(findingId, 'RESOLVED');
            fetchData();
        } catch (err) {
            console.error('Failed to resolve finding:', err);
        }
    };

    if (loading || !audit) {
        return <div className="flex items-center justify-center h-64 text-slate-400">Loading...</div>;
    }

    const canAdvance = AUDIT_STEPS.indexOf(audit.status) < AUDIT_STEPS.length - 1;

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <button onClick={() => navigate('/audits')} className="p-2 hover:bg-slate-800 rounded-[2px] text-slate-400 transition-colors">
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="flex-1">
                    <h1 className="text-2xl font-bold text-white">{audit.title}</h1>
                    <p className="text-sm text-slate-400">{audit.auditType} Audit</p>
                </div>
                {canAdvance && (
                    <button onClick={() => setShowAdvance(true)} className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-[#E0E0E0] text-black rounded-[2px] text-sm font-medium transition-colors">
                        Advance <ChevronRight className="w-4 h-4" />
                    </button>
                )}
            </div>

            <div className="bg-slate-800/50 border border-slate-700/50 rounded-[2px] p-6">
                <StatusTimeline steps={AUDIT_STEPS} currentStep={audit.status} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    {/* Scope */}
                    <div className="bg-slate-800/50 border border-slate-700/50 rounded-[2px] p-5">
                        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Scope</h3>
                        <p className="text-slate-300 text-sm whitespace-pre-wrap">{audit.scope || 'No scope defined'}</p>
                    </div>

                    {/* Findings */}
                    <div className="bg-slate-800/50 border border-slate-700/50 rounded-[2px] p-5">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Findings ({audit.findings.length})</h3>
                            <button onClick={() => setShowAddFinding(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-[2px] text-xs font-medium transition-colors">
                                <Plus className="w-3.5 h-3.5" /> Add Finding
                            </button>
                        </div>
                        {audit.findings.length === 0 ? (
                            <p className="text-slate-500 text-sm">No findings yet.</p>
                        ) : (
                            <div className="space-y-3">
                                {audit.findings.map(f => (
                                    <div key={f.id} className="flex items-center justify-between p-3 bg-slate-900/50 rounded-[2px] border border-slate-700/30">
                                        <div className="flex items-center gap-3">
                                            <SeverityBadge level={f.riskLevel} score={f.cvssScore} />
                                            <span className="text-sm text-white font-medium">{f.title}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <StatusBadge status={f.status} />
                                            {f.status === 'OPEN' && (
                                                <button onClick={() => handleResolveFinding(f.id)} className="text-xs text-green-400 hover:text-green-300 font-medium">Resolve</button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Executive Summary */}
                    {audit.executiveSummary && (
                        <div className="bg-slate-800/50 border border-slate-700/50 rounded-[2px] p-5">
                            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Executive Summary</h3>
                            <p className="text-slate-300 text-sm whitespace-pre-wrap">{audit.executiveSummary}</p>
                        </div>
                    )}
                </div>

                {/* Sidebar */}
                <div className="space-y-6">
                    <div className="bg-slate-800/50 border border-slate-700/50 rounded-[2px] p-5 space-y-3">
                        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Details</h3>
                        <div className="flex justify-between text-sm">
                            <span className="text-slate-400">Lead Auditor</span>
                            <span className="text-white">{audit.leadAuditor || '-'}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-slate-400">Start Date</span>
                            <span className="text-white">{audit.startDate || '-'}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-slate-400">End Date</span>
                            <span className="text-white">{audit.endDate || '-'}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-slate-400">Methodology</span>
                            <span className="text-white">{audit.methodology || '-'}</span>
                        </div>
                    </div>

                    {/* Activity Log */}
                    <div className="bg-slate-800/50 border border-slate-700/50 rounded-[2px] p-5">
                        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Activity Log</h3>
                        {activity.length === 0 ? (
                            <p className="text-slate-500 text-sm">No activity yet.</p>
                        ) : (
                            <div className="space-y-3 max-h-64 overflow-y-auto">
                                {activity.map(a => (
                                    <div key={a.id} className="text-xs">
                                        <div className="text-slate-300">{a.details}</div>
                                        <div className="text-slate-500 mt-0.5">{a.performedBy} - {new Date(a.createdAt).toLocaleString()}</div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Modals */}
            <ConfirmDialog isOpen={showAdvance} onClose={() => setShowAdvance(false)} onConfirm={handleAdvance}
                title="Advance Audit Status"
                message={`Are you sure you want to advance this audit from ${audit.status} to ${AUDIT_STEPS[AUDIT_STEPS.indexOf(audit.status) + 1] || ''}?`}
                confirmLabel="Advance" />

            <Modal isOpen={showAddFinding} onClose={() => setShowAddFinding(false)} title="Add Finding">
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm text-slate-400 mb-1">Title</label>
                        <input value={findingForm.title} onChange={e => setFindingForm(p => ({ ...p, title: e.target.value }))} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-[2px] text-white text-sm focus:outline-none focus:border-primary-500" />
                    </div>
                    <div>
                        <label className="block text-sm text-slate-400 mb-1">Risk Level</label>
                        <select value={findingForm.riskLevel} onChange={e => setFindingForm(p => ({ ...p, riskLevel: e.target.value }))} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-[2px] text-white text-sm">
                            <option value="CRITICAL">Critical</option>
                            <option value="HIGH">High</option>
                            <option value="MEDIUM">Medium</option>
                            <option value="LOW">Low</option>
                            <option value="INFO">Info</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm text-slate-400 mb-1">CVSS Score</label>
                        <input type="number" step="0.1" min="0" max="10" value={findingForm.cvssScore} onChange={e => setFindingForm(p => ({ ...p, cvssScore: parseFloat(e.target.value) }))} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-[2px] text-white text-sm" />
                    </div>
                    <div>
                        <label className="block text-sm text-slate-400 mb-1">Affected Asset</label>
                        <input value={findingForm.affectedAsset} onChange={e => setFindingForm(p => ({ ...p, affectedAsset: e.target.value }))} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-[2px] text-white text-sm" />
                    </div>
                    <div>
                        <label className="block text-sm text-slate-400 mb-1">Description</label>
                        <textarea value={findingForm.description} onChange={e => setFindingForm(p => ({ ...p, description: e.target.value }))} rows={3} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-[2px] text-white text-sm" />
                    </div>
                    <div>
                        <label className="block text-sm text-slate-400 mb-1">Recommendation</label>
                        <textarea value={findingForm.recommendation} onChange={e => setFindingForm(p => ({ ...p, recommendation: e.target.value }))} rows={2} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-[2px] text-white text-sm" />
                    </div>
                    <div className="flex justify-end gap-3 pt-2">
                        <button onClick={() => setShowAddFinding(false)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-[2px] text-sm">Cancel</button>
                        <button onClick={handleAddFinding} disabled={!findingForm.title} className="px-4 py-2 bg-white hover:bg-[#E0E0E0] text-black rounded-[2px] text-sm font-medium disabled:opacity-50">Add Finding</button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default AuditDetail;
