import React, { useEffect, useState } from 'react';
import { CheckCircle2, XCircle, Eye, Copy, Key } from 'lucide-react';
import { onboardingService } from '../lib/services';
import type { OnboardingRequest } from '../types';
import clsx from 'clsx';

interface ProvisionCredentials {
    companyId: string;
    apiKey: string;
    adminEmail: string;
    tempPassword: string;
    domain: string;
    companyName: string;
}

const OnboardingRequests: React.FC = () => {
    const [requests, setRequests] = useState<OnboardingRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState<OnboardingRequest | null>(null);
    const [credentials, setCredentials] = useState<ProvisionCredentials | null>(null);

    const fetchData = async () => {
        try {
            const data = await onboardingService.listAll();
            setRequests(data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    const handleReview = async (id: string, status: string) => {
        try {
            const result = await onboardingService.review(id, status);
            // If approved, show the provisioned credentials
            if (status === 'approved' && result.apiKey) {
                setCredentials(result);
            }
            setSelected(null);
            fetchData();
        } catch (err) {
            console.error(err);
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
    };

    if (loading) return <div className="p-8 text-slate-400">Loading requests...</div>;

    const pendingCount = requests.filter(r => r.status === 'pending').length;

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-white mb-1">Onboarding Requests</h1>
                <p className="text-slate-400">{pendingCount} pending requests awaiting review</p>
            </div>

            <div className="bg-slate-800/50 border border-slate-700/50 rounded-[2px] overflow-hidden">
                <table className="w-full">
                    <thead>
                        <tr className="border-b border-slate-700/50">
                            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Company</th>
                            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Domain</th>
                            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Contact</th>
                            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Status</th>
                            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Date</th>
                            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {requests.map(req => (
                            <tr key={req.id} className="border-b border-slate-700/30">
                                <td className="px-4 py-3 text-white font-medium">{req.companyName}</td>
                                <td className="px-4 py-3 text-sm text-slate-400">{req.domain}</td>
                                <td className="px-4 py-3 text-sm text-slate-300">{req.contactName} <br /><span className="text-slate-500">{req.contactEmail}</span></td>
                                <td className="px-4 py-3">
                                    <span className={clsx("text-xs font-medium px-2 py-0.5 rounded",
                                        req.status === 'pending' ? "bg-yellow-500/20 text-yellow-400" :
                                        req.status === 'approved' ? "bg-green-500/20 text-green-400" :
                                        "bg-red-500/20 text-red-400"
                                    )}>{req.status}</span>
                                </td>
                                <td className="px-4 py-3 text-sm text-slate-400">{new Date(req.createdAt).toLocaleString()}</td>
                                <td className="px-4 py-3">
                                    <div className="flex gap-2">
                                        <button onClick={() => setSelected(req)} className="text-slate-400 hover:text-primary-400 transition-colors"><Eye className="w-4 h-4" /></button>
                                        {req.status === 'pending' && (
                                            <>
                                                <button onClick={() => handleReview(req.id, 'approved')} className="text-slate-400 hover:text-green-400 transition-colors"><CheckCircle2 className="w-4 h-4" /></button>
                                                <button onClick={() => handleReview(req.id, 'rejected')} className="text-slate-400 hover:text-red-400 transition-colors"><XCircle className="w-4 h-4" /></button>
                                            </>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {requests.length === 0 && (
                            <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">No onboarding requests</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Credentials Modal - shown after approving */}
            {credentials && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-slate-900 border border-green-500/30 rounded-[2px] p-6 w-full max-w-lg">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 bg-green-500/20 rounded-full flex items-center justify-center">
                                <Key className="w-5 h-5 text-green-400" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-white">Company Provisioned</h2>
                                <p className="text-sm text-green-400">{credentials.companyName} ({credentials.domain})</p>
                            </div>
                        </div>

                        <p className="text-sm text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 rounded-[2px] p-3 mb-4">
                            Save these credentials now. The temporary password will not be shown again.
                        </p>

                        <div className="space-y-3">
                            <CredentialRow label="Domain" value={credentials.domain} onCopy={copyToClipboard} />
                            <CredentialRow label="Admin Email" value={credentials.adminEmail} onCopy={copyToClipboard} />
                            <CredentialRow label="Temp Password" value={credentials.tempPassword} onCopy={copyToClipboard} />
                            <CredentialRow label="API Key" value={credentials.apiKey} onCopy={copyToClipboard} />
                            <CredentialRow label="Company ID" value={credentials.companyId} onCopy={copyToClipboard} />
                        </div>

                        <div className="mt-6 flex justify-end">
                            <button onClick={() => setCredentials(null)} className="px-6 py-2 bg-white hover:bg-[#E0E0E0] text-black rounded-[2px] transition-colors">
                                Done
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Detail Modal */}
            {selected && !credentials && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setSelected(null)}>
                    <div className="bg-slate-900 border border-slate-700 rounded-[2px] p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                        <h2 className="text-xl font-bold text-white mb-4">Onboarding Request: {selected.companyName}</h2>

                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div><span className="text-slate-500">Domain:</span> <span className="text-white ml-2">{selected.domain}</span></div>
                            <div><span className="text-slate-500">Contact:</span> <span className="text-white ml-2">{selected.contactName}</span></div>
                            <div><span className="text-slate-500">Email:</span> <span className="text-white ml-2">{selected.contactEmail}</span></div>
                            <div><span className="text-slate-500">Phone:</span> <span className="text-white ml-2">{selected.contactPhone}</span></div>
                        </div>

                        <div className="mt-4 pt-4 border-t border-slate-700">
                            <h3 className="text-sm font-semibold text-slate-300 mb-2">Legal Agreements</h3>
                            <div className="flex gap-4 text-sm">
                                <span className={selected.acceptsTerms ? "text-green-400" : "text-red-400"}>Terms: {selected.acceptsTerms ? 'Yes' : 'No'}</span>
                                <span className={selected.acceptsDpa ? "text-green-400" : "text-red-400"}>DPA: {selected.acceptsDpa ? 'Yes' : 'No'}</span>
                                <span className={selected.acceptsNda ? "text-green-400" : "text-red-400"}>NDA: {selected.acceptsNda ? 'Yes' : 'No'}</span>
                            </div>
                        </div>

                        <div className="mt-4 pt-4 border-t border-slate-700">
                            <h3 className="text-sm font-semibold text-slate-300 mb-2">Monitoring Scope</h3>
                            <div className="flex gap-4 text-sm flex-wrap">
                                {selected.monitorNetwork && <span className="px-2 py-0.5 bg-primary-500/20 text-primary-400 rounded">Network</span>}
                                {selected.monitorEndpoints && <span className="px-2 py-0.5 bg-primary-500/20 text-primary-400 rounded">Endpoints</span>}
                                {selected.monitorCloud && <span className="px-2 py-0.5 bg-primary-500/20 text-primary-400 rounded">Cloud</span>}
                                {selected.monitorEmail && <span className="px-2 py-0.5 bg-primary-500/20 text-primary-400 rounded">Email</span>}
                            </div>
                        </div>

                        <div className="mt-4 pt-4 border-t border-slate-700 grid grid-cols-3 gap-4 text-sm">
                            <div><span className="text-slate-500">Servers:</span> <span className="text-white ml-2">{selected.numServers}</span></div>
                            <div><span className="text-slate-500">Endpoints:</span> <span className="text-white ml-2">{selected.numEndpoints}</span></div>
                            <div><span className="text-slate-500">Locations:</span> <span className="text-white ml-2">{selected.numLocations}</span></div>
                        </div>

                        {selected.currentSecurityTools && (
                            <div className="mt-4 pt-4 border-t border-slate-700">
                                <h3 className="text-sm font-semibold text-slate-300 mb-1">Current Security Tools</h3>
                                <p className="text-sm text-slate-400">{selected.currentSecurityTools}</p>
                            </div>
                        )}

                        {selected.additionalNotes && (
                            <div className="mt-4 pt-4 border-t border-slate-700">
                                <h3 className="text-sm font-semibold text-slate-300 mb-1">Additional Notes</h3>
                                <p className="text-sm text-slate-400">{selected.additionalNotes}</p>
                            </div>
                        )}

                        <div className="mt-6 flex justify-between items-center">
                            <span className={clsx("text-sm font-medium px-3 py-1 rounded",
                                selected.status === 'pending' ? "bg-yellow-500/20 text-yellow-400" :
                                selected.status === 'approved' ? "bg-green-500/20 text-green-400" :
                                "bg-red-500/20 text-red-400"
                            )}>{selected.status}</span>

                            {selected.status === 'pending' && (
                                <div className="flex gap-3">
                                    <button onClick={() => handleReview(selected.id, 'rejected')} className="px-4 py-2 bg-red-600/20 text-red-400 hover:bg-red-600/30 rounded-[2px] transition-colors">Reject</button>
                                    <button onClick={() => handleReview(selected.id, 'approved')} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-[2px] transition-colors">Approve</button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const CredentialRow: React.FC<{ label: string; value: string; onCopy: (v: string) => void }> = ({ label, value, onCopy }) => (
    <div className="flex items-center justify-between bg-slate-800 rounded-[2px] px-4 py-2.5">
        <div>
            <div className="text-xs text-slate-500">{label}</div>
            <div className="text-sm text-white font-mono">{value}</div>
        </div>
        <button onClick={() => onCopy(value)} className="text-slate-500 hover:text-primary-400 transition-colors p-1">
            <Copy className="w-4 h-4" />
        </button>
    </div>
);

export default OnboardingRequests;
