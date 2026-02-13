import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardCheck, Plus } from 'lucide-react';
import { auditService } from '../lib/services';
import type { SecurityAudit } from '../types';
import DataTable, { type Column } from '../components/DataTable';
import StatusBadge from '../components/StatusBadge';
import FilterBar, { type FilterConfig } from '../components/FilterBar';
import EmptyState from '../components/EmptyState';
import Modal from '../components/Modal';

const Audits: React.FC = () => {
    const navigate = useNavigate();
    const [audits, setAudits] = useState<SecurityAudit[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterValues, setFilterValues] = useState<Record<string, string>>({});
    const [showCreate, setShowCreate] = useState(false);
    const [form, setForm] = useState({ title: '', auditType: 'INFRASTRUCTURE', scope: '', methodology: '', leadAuditor: '' });

    const fetchAudits = async () => {
        setLoading(true);
        try {
            setAudits(await auditService.list());
        } catch (err) {
            console.error('Failed to fetch audits:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchAudits(); }, []);

    const handleCreate = async () => {
        try {
            await auditService.create(form);
            setShowCreate(false);
            setForm({ title: '', auditType: 'INFRASTRUCTURE', scope: '', methodology: '', leadAuditor: '' });
            fetchAudits();
        } catch (err) {
            console.error('Failed to create audit:', err);
        }
    };

    const filterConfigs: FilterConfig[] = [
        {
            key: 'status', label: 'All Statuses',
            options: [
                { label: 'Scoping', value: 'SCOPING' },
                { label: 'Scanning', value: 'SCANNING' },
                { label: 'Testing', value: 'TESTING' },
                { label: 'Reporting', value: 'REPORTING' },
                { label: 'Delivered', value: 'DELIVERED' },
            ]
        },
    ];

    const filtered = audits.filter(a => !filterValues.status || a.status === filterValues.status);

    const columns: Column<SecurityAudit>[] = [
        { key: 'title', header: 'Title', render: (a) => <span className="font-medium text-white">{a.title}</span> },
        { key: 'auditType', header: 'Type', render: (a) => <span className="text-slate-300">{a.auditType}</span> },
        { key: 'status', header: 'Status', render: (a) => <StatusBadge status={a.status} /> },
        { key: 'leadAuditor', header: 'Lead', render: (a) => <span className="text-slate-400">{a.leadAuditor || '-'}</span> },
        { key: 'startDate', header: 'Start', render: (a) => <span className="text-slate-400">{a.startDate || '-'}</span> },
        { key: 'createdAt', header: 'Created', render: (a) => <span className="text-slate-500 text-xs">{new Date(a.createdAt).toLocaleDateString()}</span> },
    ];

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-white">Security Audits</h1>
                <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-[#E0E0E0] text-black rounded-[2px] text-sm font-medium transition-colors">
                    <Plus className="w-4 h-4" /> New Audit
                </button>
            </div>

            <FilterBar filters={filterConfigs} values={filterValues} onFilterChange={(k, v) => setFilterValues(p => ({ ...p, [k]: v }))} />

            {!loading && filtered.length === 0 ? (
                <EmptyState icon={ClipboardCheck} title="No audits yet" message="Create your first security audit to get started." action={{ label: 'Create Audit', onClick: () => setShowCreate(true) }} />
            ) : (
                <DataTable columns={columns} data={filtered} loading={loading} keyExtractor={a => a.id} onRowClick={a => navigate(`/audits/${a.id}`)} />
            )}

            <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Create Security Audit">
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm text-slate-400 mb-1">Title</label>
                        <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-[2px] text-white text-sm focus:outline-none focus:border-primary-500" />
                    </div>
                    <div>
                        <label className="block text-sm text-slate-400 mb-1">Audit Type</label>
                        <select value={form.auditType} onChange={e => setForm(p => ({ ...p, auditType: e.target.value }))} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-[2px] text-white text-sm focus:outline-none focus:border-primary-500">
                            <option value="INFRASTRUCTURE">Infrastructure</option>
                            <option value="APPLICATION">Application</option>
                            <option value="NETWORK">Network</option>
                            <option value="COMPLIANCE">Compliance</option>
                            <option value="CLOUD">Cloud</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm text-slate-400 mb-1">Scope</label>
                        <textarea value={form.scope} onChange={e => setForm(p => ({ ...p, scope: e.target.value }))} rows={3} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-[2px] text-white text-sm focus:outline-none focus:border-primary-500" />
                    </div>
                    <div>
                        <label className="block text-sm text-slate-400 mb-1">Lead Auditor</label>
                        <input value={form.leadAuditor} onChange={e => setForm(p => ({ ...p, leadAuditor: e.target.value }))} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-[2px] text-white text-sm focus:outline-none focus:border-primary-500" />
                    </div>
                    <div className="flex justify-end gap-3 pt-2">
                        <button onClick={() => setShowCreate(false)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-[2px] text-sm">Cancel</button>
                        <button onClick={handleCreate} disabled={!form.title} className="px-4 py-2 bg-white hover:bg-[#E0E0E0] text-black rounded-[2px] text-sm font-medium disabled:opacity-50">Create</button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default Audits;
