import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bug, Plus } from 'lucide-react';
import { vulnerabilityService } from '../lib/services';
import type { Vulnerability } from '../types';
import DataTable, { type Column } from '../components/DataTable';
import StatusBadge from '../components/StatusBadge';
import SeverityBadge from '../components/SeverityBadge';
import FilterBar, { type FilterConfig } from '../components/FilterBar';
import EmptyState from '../components/EmptyState';
import Modal from '../components/Modal';

const Vulnerabilities: React.FC = () => {
    const navigate = useNavigate();
    const [vulns, setVulns] = useState<Vulnerability[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterValues, setFilterValues] = useState<Record<string, string>>({});
    const [showCreate, setShowCreate] = useState(false);
    const [form, setForm] = useState({ title: '', description: '', cveId: '', riskLevel: 'MEDIUM', cvssScore: 5.0, affectedAsset: '', remediationPlan: '' });

    const fetchVulns = async () => {
        setLoading(true);
        try {
            setVulns(await vulnerabilityService.list());
        } catch (err) {
            console.error('Failed to fetch vulnerabilities:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchVulns(); }, []);

    const handleCreate = async () => {
        try {
            await vulnerabilityService.create(form);
            setShowCreate(false);
            setForm({ title: '', description: '', cveId: '', riskLevel: 'MEDIUM', cvssScore: 5.0, affectedAsset: '', remediationPlan: '' });
            fetchVulns();
        } catch (err) {
            console.error('Failed to create vulnerability:', err);
        }
    };

    const filterConfigs: FilterConfig[] = [
        {
            key: 'status', label: 'All Statuses',
            options: [
                { label: 'Detected', value: 'DETECTED' },
                { label: 'Confirmed', value: 'CONFIRMED' },
                { label: 'In Remediation', value: 'IN_REMEDIATION' },
                { label: 'Fixed', value: 'FIXED' },
                { label: 'Verified', value: 'VERIFIED' },
            ]
        },
        {
            key: 'riskLevel', label: 'All Risk Levels',
            options: [
                { label: 'Critical', value: 'CRITICAL' },
                { label: 'High', value: 'HIGH' },
                { label: 'Medium', value: 'MEDIUM' },
                { label: 'Low', value: 'LOW' },
            ]
        },
    ];

    const filtered = vulns.filter(v =>
        (!filterValues.status || v.status === filterValues.status) &&
        (!filterValues.riskLevel || v.riskLevel === filterValues.riskLevel)
    );

    const columns: Column<Vulnerability>[] = [
        { key: 'title', header: 'Title', render: (v) => <span className="font-medium text-white">{v.title}</span> },
        { key: 'cveId', header: 'CVE', render: (v) => <span className="font-mono text-xs text-slate-400">{v.cveId || '-'}</span> },
        { key: 'riskLevel', header: 'Risk', render: (v) => <SeverityBadge level={v.riskLevel} score={v.cvssScore} /> },
        { key: 'status', header: 'Status', render: (v) => <StatusBadge status={v.status} /> },
        { key: 'affectedAsset', header: 'Affected Asset', render: (v) => <span className="text-slate-400 text-sm">{v.affectedAsset || '-'}</span> },
        { key: 'detectedAt', header: 'Detected', render: (v) => <span className="text-slate-500 text-xs">{new Date(v.detectedAt).toLocaleDateString()}</span> },
    ];

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-white">Vulnerabilities</h1>
                <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-[#E0E0E0] text-black rounded-[2px] text-sm font-medium transition-colors">
                    <Plus className="w-4 h-4" /> Report Vulnerability
                </button>
            </div>

            <FilterBar filters={filterConfigs} values={filterValues} onFilterChange={(k, v) => setFilterValues(p => ({ ...p, [k]: v }))} />

            {!loading && filtered.length === 0 ? (
                <EmptyState icon={Bug} title="No vulnerabilities" message="No vulnerabilities have been reported yet." action={{ label: 'Report Vulnerability', onClick: () => setShowCreate(true) }} />
            ) : (
                <DataTable columns={columns} data={filtered} loading={loading} keyExtractor={v => v.id} onRowClick={v => navigate(`/vulnerabilities/${v.id}`)} />
            )}

            <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Report Vulnerability">
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm text-slate-400 mb-1">Title</label>
                        <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-[2px] text-white text-sm focus:outline-none focus:border-primary-500" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm text-slate-400 mb-1">CVE ID</label>
                            <input value={form.cveId} onChange={e => setForm(p => ({ ...p, cveId: e.target.value }))} placeholder="CVE-2024-XXXXX" className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-[2px] text-white text-sm" />
                        </div>
                        <div>
                            <label className="block text-sm text-slate-400 mb-1">Risk Level</label>
                            <select value={form.riskLevel} onChange={e => setForm(p => ({ ...p, riskLevel: e.target.value }))} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-[2px] text-white text-sm">
                                <option value="CRITICAL">Critical</option>
                                <option value="HIGH">High</option>
                                <option value="MEDIUM">Medium</option>
                                <option value="LOW">Low</option>
                                <option value="INFO">Info</option>
                            </select>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm text-slate-400 mb-1">CVSS Score</label>
                            <input type="number" step="0.1" min="0" max="10" value={form.cvssScore} onChange={e => setForm(p => ({ ...p, cvssScore: parseFloat(e.target.value) }))} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-[2px] text-white text-sm" />
                        </div>
                        <div>
                            <label className="block text-sm text-slate-400 mb-1">Affected Asset</label>
                            <input value={form.affectedAsset} onChange={e => setForm(p => ({ ...p, affectedAsset: e.target.value }))} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-[2px] text-white text-sm" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm text-slate-400 mb-1">Description</label>
                        <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={3} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-[2px] text-white text-sm" />
                    </div>
                    <div className="flex justify-end gap-3 pt-2">
                        <button onClick={() => setShowCreate(false)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-[2px] text-sm">Cancel</button>
                        <button onClick={handleCreate} disabled={!form.title} className="px-4 py-2 bg-white hover:bg-[#E0E0E0] text-black rounded-[2px] text-sm font-medium disabled:opacity-50">Report</button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default Vulnerabilities;
