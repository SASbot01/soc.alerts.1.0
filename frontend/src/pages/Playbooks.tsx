import React, { useState, useEffect } from 'react';
import { Play, Pause, Plus, Zap, Clock, CheckCircle, XCircle, ChevronRight, ChevronDown, Shield, Download, Link2, Search } from 'lucide-react';
import api from '../lib/api';
import Modal from '../components/Modal';

interface Playbook {
    id: string;
    name: string;
    description: string;
    triggerType: string;
    triggerCondition: string;
    active: boolean;
    category: string | null;
    isTemplate: boolean | null;
    mitreTechniques: string | null;
    targetAssetTypes: string | null;
    sourceTemplateId: string | null;
    createdAt: string;
}

interface PlaybookTemplate {
    id: string;
    name: string;
    description: string;
    category: string;
    triggerType: string;
    triggerCondition: string;
    mitreTechniques: string;
    targetAssetTypes: string;
    stepCount: number;
    steps: { id: string; stepOrder: number; actionType: string; description: string }[];
    alreadyDeployed: boolean;
}

interface Execution {
    id: string;
    playbookId: string;
    playbookName: string | null;
    status: string;
    startedAt: string;
    completedAt: string | null;
    errorMessage: string | null;
}

interface Asset {
    id: string;
    name: string;
    assetType: string;
    ipAddress: string;
    status: string;
}

interface Assignment {
    assetId: string;
    assetName: string;
    assetType: string;
    assetIp: string;
    playbookId: string;
    isActive: boolean;
    priority: number;
}

const triggerLabels: Record<string, string> = {
    THREAT_SEVERITY: 'Threat Severity',
    THREAT_TYPE: 'Threat Type',
    INCIDENT_CREATED: 'Incident Created',
    MANUAL: 'Manual',
};

const categoryColors: Record<string, string> = {
    BRUTE_FORCE: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
    DDOS: 'bg-red-500/10 text-red-400 border-red-500/20',
    RANSOMWARE: 'bg-red-600/10 text-red-500 border-red-600/20',
    MALWARE: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    PHISHING: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    PORT_SCAN: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    UNAUTHORIZED_ACCESS: 'bg-rose-400/10 text-rose-300 border-rose-400/20',
    WEB_ATTACK: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    C2_COMMUNICATION: 'bg-red-500/10 text-red-400 border-red-500/20',
    LATERAL_MOVEMENT: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    PRIVILEGE_ESCALATION: 'bg-pink-500/10 text-pink-400 border-pink-500/20',
    DATA_EXFILTRATION: 'bg-rose-600/10 text-rose-500 border-rose-600/20',
    INSIDER_THREAT: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
    ZERO_DAY: 'bg-red-700/10 text-red-600 border-red-700/20',
    COMPLIANCE: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
};

const Playbooks: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'my' | 'templates' | 'executions'>('my');
    const [playbooks, setPlaybooks] = useState<Playbook[]>([]);
    const [templates, setTemplates] = useState<PlaybookTemplate[]>([]);
    const [executions, setExecutions] = useState<Execution[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);
    const [form, setForm] = useState({ name: '', description: '', triggerType: 'MANUAL', triggerCondition: '' });
    const [expandedTemplate, setExpandedTemplate] = useState<string | null>(null);
    const [deploying, setDeploying] = useState<string | null>(null);

    // Assignment modal state
    const [assignModal, setAssignModal] = useState<{ playbookId: string; playbookName: string } | null>(null);
    const [assets, setAssets] = useState<Asset[]>([]);
    const [assignedAssetIds, setAssignedAssetIds] = useState<Set<string>>(new Set());
    const [assetSearch, setAssetSearch] = useState('');
    const [selectedAssetIds, setSelectedAssetIds] = useState<Set<string>>(new Set());

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const [pb, ex, tpl] = await Promise.all([
                api.get('/playbooks').then(r => r.data),
                api.get('/playbooks/executions').then(r => r.data),
                api.get('/playbooks/templates').then(r => r.data),
            ]);
            setPlaybooks(pb);
            setExecutions(ex);
            setTemplates(tpl);
        } catch { /* ignore */ }
        setLoading(false);
    };

    const togglePlaybook = async (id: string) => {
        await api.patch(`/playbooks/${id}/toggle`);
        loadData();
    };

    const executePlaybook = async (id: string) => {
        await api.post(`/playbooks/${id}/execute`);
        loadData();
    };

    const createPlaybook = async () => {
        await api.post('/playbooks', { ...form, steps: [] });
        setShowCreate(false);
        setForm({ name: '', description: '', triggerType: 'MANUAL', triggerCondition: '' });
        loadData();
    };

    const deployTemplate = async (templateId: string) => {
        setDeploying(templateId);
        try {
            await api.post('/playbooks/templates/deploy', { templateId, activateImmediately: true });
            loadData();
        } catch { /* ignore */ }
        setDeploying(null);
    };

    const openAssignModal = async (playbookId: string, playbookName: string) => {
        try {
            const [assetList, assignments] = await Promise.all([
                api.get('/assets').then(r => r.data),
                api.get(`/playbooks/${playbookId}/assignments`).then(r => r.data),
            ]);
            setAssets(assetList);
            const assigned = new Set<string>((assignments as Assignment[]).map((a: Assignment) => a.assetId));
            setAssignedAssetIds(assigned);
            setSelectedAssetIds(new Set(assigned));
            setAssignModal({ playbookId, playbookName });
            setAssetSearch('');
        } catch { /* ignore */ }
    };

    const saveAssignments = async () => {
        if (!assignModal) return;
        const { playbookId } = assignModal;

        // Unassign removed
        for (const assetId of assignedAssetIds) {
            if (!selectedAssetIds.has(assetId)) {
                await api.delete(`/playbooks/assignments/${playbookId}/${assetId}`);
            }
        }

        // Assign new
        const newIds = [...selectedAssetIds].filter(id => !assignedAssetIds.has(id));
        if (newIds.length > 0) {
            await api.post('/playbooks/assignments/bulk', { playbookId, assetIds: newIds });
        }

        setAssignModal(null);
        loadData();
    };

    const toggleAssetSelection = (assetId: string) => {
        setSelectedAssetIds(prev => {
            const next = new Set(prev);
            if (next.has(assetId)) next.delete(assetId);
            else next.add(assetId);
            return next;
        });
    };

    const filteredAssets = assets.filter(a =>
        !assetSearch || a.name.toLowerCase().includes(assetSearch.toLowerCase()) ||
        a.ipAddress?.toLowerCase().includes(assetSearch.toLowerCase())
    );

    if (loading) return <div className="p-6 text-slate-400">Loading playbooks...</div>;

    const tabs = [
        { key: 'my' as const, label: 'My Playbooks', count: playbooks.length },
        { key: 'templates' as const, label: 'Template Library', count: templates.length },
        { key: 'executions' as const, label: 'Executions', count: executions.length },
    ];

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                        <Zap className="w-6 h-6 text-yellow-400" /> SOAR Playbooks
                    </h1>
                    <p className="text-slate-400 text-sm mt-1">Automated response workflows for security events</p>
                </div>
                {activeTab === 'my' && (
                    <button
                        onClick={() => setShowCreate(true)}
                        className="flex items-center gap-2 bg-white text-black px-4 py-2 rounded-[2px] text-xs font-semibold uppercase tracking-wider hover:bg-slate-200 transition-colors"
                    >
                        <Plus className="w-4 h-4" /> New Playbook
                    </button>
                )}
            </div>

            {/* Tab Navigation */}
            <div className="flex gap-1 border-b border-slate-800">
                {tabs.map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className={`px-4 py-2.5 text-sm font-medium transition-colors relative ${
                            activeTab === tab.key
                                ? 'text-white'
                                : 'text-slate-500 hover:text-slate-300'
                        }`}
                    >
                        {tab.label}
                        <span className={`ml-2 text-[10px] px-1.5 py-0.5 rounded-[2px] ${
                            activeTab === tab.key ? 'bg-white/10 text-white' : 'bg-slate-800 text-slate-500'
                        }`}>
                            {tab.count}
                        </span>
                        {activeTab === tab.key && (
                            <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-white" />
                        )}
                    </button>
                ))}
            </div>

            {/* My Playbooks Tab */}
            {activeTab === 'my' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {playbooks.length === 0 ? (
                        <div className="col-span-3 text-center py-16 text-slate-500">
                            <Shield className="w-12 h-12 mx-auto mb-3 opacity-30" />
                            <p className="text-lg">No playbooks yet</p>
                            <p className="text-sm mt-1">Deploy templates from the Template Library or create a custom playbook</p>
                        </div>
                    ) : playbooks.map(pb => (
                        <div key={pb.id} className="bg-slate-900/60 border border-slate-800 rounded-[2px] p-5 hover:border-slate-700 transition-colors">
                            <div className="flex items-start justify-between mb-3">
                                <div className="flex-1 min-w-0">
                                    <h3 className="text-white font-semibold truncate">{pb.name}</h3>
                                    <p className="text-slate-500 text-xs mt-1 line-clamp-2">{pb.description}</p>
                                </div>
                                <button
                                    onClick={() => togglePlaybook(pb.id)}
                                    className={`ml-2 p-1.5 rounded-[2px] transition-colors ${pb.active ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20' : 'bg-slate-800 text-slate-500 hover:bg-slate-700'}`}
                                >
                                    {pb.active ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                                </button>
                            </div>

                            <div className="flex items-center gap-2 mb-3 flex-wrap">
                                {pb.category && (
                                    <span className={`px-2 py-0.5 rounded-[2px] text-[10px] uppercase font-bold border ${categoryColors[pb.category] || 'bg-slate-800 text-slate-400 border-slate-700'}`}>
                                        {pb.category.replace('_', ' ')}
                                    </span>
                                )}
                                <span className="px-2 py-0.5 bg-slate-800 text-slate-400 rounded-[2px] text-[10px] uppercase font-medium">
                                    {triggerLabels[pb.triggerType] || pb.triggerType}
                                </span>
                                {pb.triggerCondition && (
                                    <span className="text-[10px] text-slate-500 truncate">{pb.triggerCondition}</span>
                                )}
                            </div>

                            {pb.mitreTechniques && (
                                <div className="flex gap-1 mb-3 flex-wrap">
                                    {pb.mitreTechniques.split(',').map(t => (
                                        <span key={t} className="text-[9px] px-1.5 py-0.5 bg-blue-500/10 text-blue-400 rounded-[2px] font-mono">
                                            {t.trim()}
                                        </span>
                                    ))}
                                </div>
                            )}

                            <div className="flex items-center justify-between pt-3 border-t border-slate-800">
                                <div className="flex items-center gap-2">
                                    <span className={`text-xs font-medium ${pb.active ? 'text-emerald-400' : 'text-slate-500'}`}>
                                        {pb.active ? 'Active' : 'Disabled'}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => openAssignModal(pb.id, pb.name)}
                                        className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
                                    >
                                        <Link2 className="w-3 h-3" /> Assign Assets
                                    </button>
                                    <button
                                        onClick={() => executePlaybook(pb.id)}
                                        className="flex items-center gap-1 text-xs text-slate-400 hover:text-white transition-colors"
                                    >
                                        Run Now <ChevronRight className="w-3 h-3" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Template Library Tab */}
            {activeTab === 'templates' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {templates.map(tpl => (
                        <div key={tpl.id} className="bg-slate-900/60 border border-slate-800 rounded-[2px] hover:border-slate-700 transition-colors">
                            <div className="p-5">
                                <div className="flex items-start justify-between mb-3">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className={`px-2 py-0.5 rounded-[2px] text-[10px] uppercase font-bold border ${categoryColors[tpl.category] || 'bg-slate-800 text-slate-400 border-slate-700'}`}>
                                                {tpl.category.replace(/_/g, ' ')}
                                            </span>
                                        </div>
                                        <h3 className="text-white font-semibold">{tpl.name}</h3>
                                    </div>
                                    <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded-[2px] whitespace-nowrap">
                                        {tpl.stepCount} steps
                                    </span>
                                </div>

                                <p className="text-slate-500 text-xs mb-3 line-clamp-3">{tpl.description}</p>

                                {/* MITRE tags */}
                                <div className="flex gap-1 mb-2 flex-wrap">
                                    {tpl.mitreTechniques.split(',').map(t => (
                                        <span key={t} className="text-[9px] px-1.5 py-0.5 bg-blue-500/10 text-blue-400 rounded-[2px] font-mono">
                                            {t.trim()}
                                        </span>
                                    ))}
                                </div>

                                {/* Target asset types */}
                                <div className="flex gap-1 mb-3 flex-wrap">
                                    {tpl.targetAssetTypes.split(',').map(t => (
                                        <span key={t} className="text-[9px] px-1.5 py-0.5 bg-slate-800 text-slate-400 rounded-[2px]">
                                            {t.trim().replace(/_/g, ' ')}
                                        </span>
                                    ))}
                                </div>

                                <div className="flex items-center gap-2 mb-3">
                                    <span className="px-2 py-0.5 bg-slate-800 text-slate-400 rounded-[2px] text-[10px] uppercase font-medium">
                                        {triggerLabels[tpl.triggerType] || tpl.triggerType}
                                    </span>
                                    <span className="text-[10px] text-slate-500">{tpl.triggerCondition}</span>
                                </div>

                                {/* Expand steps */}
                                <button
                                    onClick={() => setExpandedTemplate(expandedTemplate === tpl.id ? null : tpl.id)}
                                    className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 transition-colors mb-3"
                                >
                                    {expandedTemplate === tpl.id ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                    View Steps
                                </button>

                                {expandedTemplate === tpl.id && (
                                    <div className="space-y-1.5 mb-3 pl-2 border-l-2 border-slate-800">
                                        {tpl.steps.map((step, i) => (
                                            <div key={step.id} className="text-[11px]">
                                                <span className="text-slate-500 mr-1.5">{i + 1}.</span>
                                                <span className={`inline-block px-1 py-0 rounded-[1px] text-[9px] font-mono mr-1.5 ${
                                                    step.actionType === 'BLOCK_IP' ? 'bg-red-500/10 text-red-400' :
                                                    step.actionType === 'CREATE_INCIDENT' ? 'bg-orange-500/10 text-orange-400' :
                                                    step.actionType === 'SEND_ALERT' ? 'bg-yellow-500/10 text-yellow-400' :
                                                    step.actionType === 'ENRICH_IP' ? 'bg-blue-500/10 text-blue-400' :
                                                    step.actionType === 'NOTIFY_SLACK' ? 'bg-purple-500/10 text-purple-400' :
                                                    step.actionType === 'WEBHOOK_CALL' ? 'bg-cyan-500/10 text-cyan-400' :
                                                    'bg-slate-800 text-slate-400'
                                                }`}>
                                                    {step.actionType.replace(/_/g, ' ')}
                                                </span>
                                                <span className="text-slate-400">{step.description}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="px-5 py-3 border-t border-slate-800">
                                {tpl.alreadyDeployed ? (
                                    <span className="flex items-center gap-1.5 text-xs text-emerald-400">
                                        <CheckCircle className="w-3.5 h-3.5" /> Deployed
                                    </span>
                                ) : (
                                    <button
                                        onClick={() => deployTemplate(tpl.id)}
                                        disabled={deploying === tpl.id}
                                        className="flex items-center gap-1.5 text-xs font-semibold text-white bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-[2px] transition-colors disabled:opacity-50"
                                    >
                                        <Download className="w-3.5 h-3.5" />
                                        {deploying === tpl.id ? 'Deploying...' : 'Deploy'}
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Executions Tab */}
            {activeTab === 'executions' && (
                <div className="bg-slate-900/60 border border-slate-800 rounded-[2px]">
                    <div className="p-4 border-b border-slate-800">
                        <h2 className="text-white font-semibold flex items-center gap-2">
                            <Clock className="w-4 h-4 text-slate-400" /> Execution History
                        </h2>
                    </div>
                    <div className="divide-y divide-slate-800">
                        {executions.length === 0 ? (
                            <div className="p-8 text-center text-slate-500 text-sm">No executions yet</div>
                        ) : executions.map(ex => (
                            <div key={ex.id} className="p-4 flex items-center gap-4">
                                {ex.status === 'COMPLETED' ? (
                                    <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                                ) : ex.status === 'FAILED' ? (
                                    <XCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                                ) : (
                                    <Clock className="w-5 h-5 text-yellow-400 flex-shrink-0 animate-spin" />
                                )}
                                <div className="flex-1 min-w-0">
                                    <span className="text-sm text-white">{ex.playbookName || ex.playbookId}</span>
                                    {ex.errorMessage && (
                                        <p className="text-xs text-red-400 truncate mt-0.5">{ex.errorMessage}</p>
                                    )}
                                </div>
                                <span className="text-xs text-slate-500">{new Date(ex.startedAt).toLocaleString()}</span>
                                <span className={`text-xs font-medium px-2 py-0.5 rounded-[2px] ${
                                    ex.status === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-400' :
                                    ex.status === 'FAILED' ? 'bg-red-500/10 text-red-400' :
                                    'bg-yellow-500/10 text-yellow-400'
                                }`}>{ex.status}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Create Modal */}
            {showCreate && (
                <Modal isOpen={showCreate} title="Create Playbook" onClose={() => setShowCreate(false)}>
                    <div className="space-y-4">
                        <div>
                            <label className="text-sm text-slate-300 block mb-1">Name</label>
                            <input
                                value={form.name}
                                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                                className="w-full bg-slate-950 border border-slate-700 rounded-[2px] p-2 text-white text-sm"
                                placeholder="Playbook name"
                            />
                        </div>
                        <div>
                            <label className="text-sm text-slate-300 block mb-1">Description</label>
                            <textarea
                                value={form.description}
                                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                                className="w-full bg-slate-950 border border-slate-700 rounded-[2px] p-2 text-white text-sm"
                                rows={3}
                            />
                        </div>
                        <div>
                            <label className="text-sm text-slate-300 block mb-1">Trigger Type</label>
                            <select
                                value={form.triggerType}
                                onChange={e => setForm(f => ({ ...f, triggerType: e.target.value }))}
                                className="w-full bg-slate-950 border border-slate-700 rounded-[2px] p-2 text-white text-sm"
                            >
                                <option value="MANUAL">Manual</option>
                                <option value="THREAT_SEVERITY">Threat Severity</option>
                                <option value="THREAT_TYPE">Threat Type</option>
                                <option value="INCIDENT_CREATED">Incident Created</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-sm text-slate-300 block mb-1">Trigger Condition</label>
                            <input
                                value={form.triggerCondition}
                                onChange={e => setForm(f => ({ ...f, triggerCondition: e.target.value }))}
                                className="w-full bg-slate-950 border border-slate-700 rounded-[2px] p-2 text-white text-sm"
                                placeholder="e.g. >= 9 or DDoS Attack"
                            />
                        </div>
                        <button
                            onClick={createPlaybook}
                            className="w-full bg-white text-black py-2 rounded-[2px] text-sm font-semibold hover:bg-slate-200 transition-colors"
                        >
                            Create Playbook
                        </button>
                    </div>
                </Modal>
            )}

            {/* Assign Assets Modal */}
            {assignModal && (
                <Modal isOpen={true} title={`Assign Assets: ${assignModal.playbookName}`} onClose={() => setAssignModal(null)}>
                    <div className="space-y-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                            <input
                                value={assetSearch}
                                onChange={e => setAssetSearch(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-700 rounded-[2px] py-2 pl-9 pr-4 text-white text-sm"
                                placeholder="Search assets..."
                            />
                        </div>

                        <div className="max-h-64 overflow-y-auto space-y-1">
                            {filteredAssets.length === 0 ? (
                                <div className="text-center py-4 text-slate-500 text-sm">No assets found</div>
                            ) : filteredAssets.map(asset => (
                                <label
                                    key={asset.id}
                                    className={`flex items-center gap-3 p-2.5 rounded-[2px] cursor-pointer transition-colors ${
                                        selectedAssetIds.has(asset.id)
                                            ? 'bg-blue-500/10 border border-blue-500/30'
                                            : 'bg-slate-900 border border-slate-800 hover:border-slate-700'
                                    }`}
                                >
                                    <input
                                        type="checkbox"
                                        checked={selectedAssetIds.has(asset.id)}
                                        onChange={() => toggleAssetSelection(asset.id)}
                                        className="rounded-[2px]"
                                    />
                                    <div className="flex-1 min-w-0">
                                        <div className="text-sm text-white">{asset.name}</div>
                                        <div className="text-[10px] text-slate-500">
                                            {asset.assetType.replace(/_/g, ' ')} {asset.ipAddress && `| ${asset.ipAddress}`}
                                        </div>
                                    </div>
                                </label>
                            ))}
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                            <span className="text-xs text-slate-400">{selectedAssetIds.size} asset{selectedAssetIds.size !== 1 ? 's' : ''} selected</span>
                            <button
                                onClick={saveAssignments}
                                className="bg-white text-black px-4 py-2 rounded-[2px] text-sm font-semibold hover:bg-slate-200 transition-colors"
                            >
                                Save Assignments
                            </button>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default Playbooks;
