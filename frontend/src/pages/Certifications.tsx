import React, { useEffect, useState } from 'react';
import { Award, Plus, Ban } from 'lucide-react';
import { certificationService, auditService } from '../lib/services';
import type { SecurityCertification, SecurityAudit } from '../types';
import StatusBadge from '../components/StatusBadge';
import EmptyState from '../components/EmptyState';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';

const Certifications: React.FC = () => {
    const [certs, setCerts] = useState<SecurityCertification[]>([]);
    const [audits, setAudits] = useState<SecurityAudit[]>([]);
    const [loading, setLoading] = useState(true);
    const [showIssue, setShowIssue] = useState(false);
    const [revokeId, setRevokeId] = useState<string | null>(null);
    const [form, setForm] = useState({ certificationType: 'ISO_27001', title: '', auditId: '', issuedBy: '', notes: '' });

    const fetchData = async () => {
        setLoading(true);
        try {
            const [certsData, auditsData] = await Promise.all([
                certificationService.list(),
                auditService.list(),
            ]);
            setCerts(certsData);
            setAudits(auditsData.filter(a => a.status === 'DELIVERED'));
        } catch (err) {
            console.error('Failed to fetch data:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    const handleIssue = async () => {
        try {
            await certificationService.issue(form);
            setShowIssue(false);
            setForm({ certificationType: 'ISO_27001', title: '', auditId: '', issuedBy: '', notes: '' });
            fetchData();
        } catch (err) {
            console.error('Failed to issue certification:', err);
        }
    };

    const handleRevoke = async () => {
        if (!revokeId) return;
        try {
            await certificationService.revoke(revokeId);
            setRevokeId(null);
            fetchData();
        } catch (err) {
            console.error('Failed to revoke:', err);
        }
    };

    const isExpiringSoon = (expiresAt: string) => {
        const expires = new Date(expiresAt);
        const daysUntil = Math.ceil((expires.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        return daysUntil > 0 && daysUntil <= 30;
    };

    if (loading) {
        return (
            <div className="space-y-6">
                <h1 className="text-2xl font-bold text-white">Security Certifications</h1>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[...Array(3)].map((_, i) => (
                        <div key={i} className="bg-slate-800/50 border border-slate-700/50 rounded-[2px] p-6 animate-pulse">
                            <div className="h-10 w-10 bg-slate-700 rounded-[2px] mb-4" />
                            <div className="h-5 bg-slate-700 rounded w-3/4 mb-2" />
                            <div className="h-4 bg-slate-700 rounded w-1/2" />
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-white">Security Certifications</h1>
                <button onClick={() => setShowIssue(true)} className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-[#E0E0E0] text-black rounded-[2px] text-sm font-medium transition-colors">
                    <Plus className="w-4 h-4" /> Issue Certification
                </button>
            </div>

            {certs.length === 0 ? (
                <EmptyState icon={Award} title="No certifications" message="Issue your first security certification after completing an audit." action={{ label: 'Issue Certification', onClick: () => setShowIssue(true) }} />
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {certs.map(cert => (
                        <div key={cert.id} className="bg-slate-800/50 border border-slate-700/50 rounded-[2px] p-6 hover:border-primary-500/30 transition-all">
                            <div className="flex items-start justify-between mb-4">
                                <div className="w-10 h-10 rounded-[2px] bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                                    <Award className="w-5 h-5 text-emerald-400" />
                                </div>
                                <StatusBadge status={cert.status} />
                            </div>

                            <h3 className="text-lg font-semibold text-white mb-1">{cert.title}</h3>
                            <p className="text-sm text-slate-400 mb-4">{cert.certificationType.replace(/_/g, ' ')}</p>

                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-slate-400">Issued</span>
                                    <span className="text-white">{cert.issuedAt ? new Date(cert.issuedAt).toLocaleDateString() : '-'}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-400">Expires</span>
                                    <span className={isExpiringSoon(cert.expiresAt) ? 'text-yellow-400 font-medium' : 'text-white'}>
                                        {cert.expiresAt ? new Date(cert.expiresAt).toLocaleDateString() : '-'}
                                        {isExpiringSoon(cert.expiresAt) && ' (Soon)'}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-400">Issued By</span>
                                    <span className="text-white">{cert.issuedBy || '-'}</span>
                                </div>
                            </div>

                            {cert.status === 'ACTIVE' && (
                                <button onClick={() => setRevokeId(cert.id)} className="mt-4 flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 font-medium">
                                    <Ban className="w-3.5 h-3.5" /> Revoke
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            )}

            <Modal isOpen={showIssue} onClose={() => setShowIssue(false)} title="Issue Certification">
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm text-slate-400 mb-1">Title</label>
                        <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-[2px] text-white text-sm" />
                    </div>
                    <div>
                        <label className="block text-sm text-slate-400 mb-1">Certification Type</label>
                        <select value={form.certificationType} onChange={e => setForm(p => ({ ...p, certificationType: e.target.value }))} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-[2px] text-white text-sm">
                            <option value="ISO_27001">ISO 27001</option>
                            <option value="SOC2">SOC 2</option>
                            <option value="PCI_DSS">PCI DSS</option>
                            <option value="GDPR">GDPR Compliance</option>
                            <option value="HIPAA">HIPAA</option>
                            <option value="NIST">NIST</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm text-slate-400 mb-1">Based on Audit (optional)</label>
                        <select value={form.auditId} onChange={e => setForm(p => ({ ...p, auditId: e.target.value }))} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-[2px] text-white text-sm">
                            <option value="">No audit linked</option>
                            {audits.map(a => <option key={a.id} value={a.id}>{a.title}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm text-slate-400 mb-1">Issued By</label>
                        <input value={form.issuedBy} onChange={e => setForm(p => ({ ...p, issuedBy: e.target.value }))} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-[2px] text-white text-sm" />
                    </div>
                    <div>
                        <label className="block text-sm text-slate-400 mb-1">Notes</label>
                        <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-[2px] text-white text-sm" />
                    </div>
                    <div className="flex justify-end gap-3 pt-2">
                        <button onClick={() => setShowIssue(false)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-[2px] text-sm">Cancel</button>
                        <button onClick={handleIssue} disabled={!form.title} className="px-4 py-2 bg-white hover:bg-[#E0E0E0] text-black rounded-[2px] text-sm font-medium disabled:opacity-50">Issue</button>
                    </div>
                </div>
            </Modal>

            <ConfirmDialog isOpen={!!revokeId} onClose={() => setRevokeId(null)} onConfirm={handleRevoke}
                title="Revoke Certification"
                message="Are you sure you want to revoke this certification? This action cannot be undone."
                confirmLabel="Revoke"
                confirmColor="bg-red-600 hover:bg-red-500" />
        </div>
    );
};

export default Certifications;
