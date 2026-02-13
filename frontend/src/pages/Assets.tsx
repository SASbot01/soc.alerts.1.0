import React, { useState, useEffect } from 'react';
import { Server, Monitor, Wifi, Globe, Database, Cloud, Plus, Search, Shield, ChevronDown, ChevronUp, Link2, Radio } from 'lucide-react';
import api from '../lib/api';
import Modal from '../components/Modal';
import StatusBadge from '../components/StatusBadge';

interface Asset {
    id: string;
    name: string;
    assetType: string;
    ipAddress: string;
    hostname: string;
    operatingSystem: string;
    criticality: string;
    owner: string;
    location: string;
    status: string;
    notes: string;
    createdAt: string;
}

interface LinkedSensor {
    sensorId: string;
    sensorName: string;
    sensorType: string | null;
    category: string | null;
    isActive: boolean;
}

interface LinkedPlaybook {
    playbookId: string;
    playbookName: string;
    category: string | null;
    isActive: boolean;
    priority: number;
}

interface CompanyPlaybook {
    id: string;
    name: string;
    category: string | null;
    active: boolean;
}

const typeIcons: Record<string, React.ReactNode> = {
    SERVER: <Server className="w-5 h-5" />,
    ENDPOINT: <Monitor className="w-5 h-5" />,
    NETWORK_DEVICE: <Wifi className="w-5 h-5" />,
    APPLICATION: <Globe className="w-5 h-5" />,
    DATABASE: <Database className="w-5 h-5" />,
    CLOUD_RESOURCE: <Cloud className="w-5 h-5" />,
};

const criticalityColors: Record<string, string> = {
    CRITICAL: 'text-red-400 bg-red-500/10 border-red-500/20',
    HIGH: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
    MEDIUM: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
    LOW: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
};

const categoryColors: Record<string, string> = {
    BRUTE_FORCE: 'bg-orange-500/10 text-orange-400',
    DDOS: 'bg-red-500/10 text-red-400',
    RANSOMWARE: 'bg-red-600/10 text-red-500',
    MALWARE: 'bg-purple-500/10 text-purple-400',
    PHISHING: 'bg-yellow-500/10 text-yellow-400',
    PORT_SCAN: 'bg-blue-500/10 text-blue-400',
    UNAUTHORIZED_ACCESS: 'bg-rose-400/10 text-rose-300',
    WEB_ATTACK: 'bg-amber-500/10 text-amber-400',
    C2_COMMUNICATION: 'bg-red-500/10 text-red-400',
    LATERAL_MOVEMENT: 'bg-rose-500/10 text-rose-400',
    PRIVILEGE_ESCALATION: 'bg-pink-500/10 text-pink-400',
    DATA_EXFILTRATION: 'bg-rose-600/10 text-rose-500',
    INSIDER_THREAT: 'bg-violet-500/10 text-violet-400',
    ZERO_DAY: 'bg-red-700/10 text-red-600',
    COMPLIANCE: 'bg-cyan-500/10 text-cyan-400',
};

const Assets: React.FC = () => {
    const [assets, setAssets] = useState<Asset[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('');
    const [typeFilter, setTypeFilter] = useState('');
    const [showCreate, setShowCreate] = useState(false);
    const [form, setForm] = useState({
        name: '', assetType: 'SERVER', ipAddress: '', hostname: '',
        operatingSystem: '', criticality: 'MEDIUM', owner: '', location: '', notes: ''
    });

    // Expanded asset & playbook/sensor data
    const [expandedAssetId, setExpandedAssetId] = useState<string | null>(null);
    const [assetPlaybooks, setAssetPlaybooks] = useState<Record<string, LinkedPlaybook[]>>({});
    const [assetSensors, setAssetSensors] = useState<Record<string, LinkedSensor[]>>({});
    const [playbookCounts, setPlaybookCounts] = useState<Record<string, number>>({});
    const [sensorCounts, setSensorCounts] = useState<Record<string, number>>({});

    // Assign playbook modal
    const [assignModal, setAssignModal] = useState<{ assetId: string; assetName: string } | null>(null);
    const [companyPlaybooks, setCompanyPlaybooks] = useState<CompanyPlaybook[]>([]);
    const [assignedPlaybookIds, setAssignedPlaybookIds] = useState<Set<string>>(new Set());
    const [playbookSearch, setPlaybookSearch] = useState('');

    useEffect(() => { loadAssets(); }, []);

    const loadAssets = async () => {
        try {
            const params: Record<string, string> = {};
            if (typeFilter) params.assetType = typeFilter;
            const res = await api.get('/assets', { params });
            setAssets(res.data);

            // Load playbook and sensor counts for each asset
            const pbCounts: Record<string, number> = {};
            const snCounts: Record<string, number> = {};
            for (const asset of res.data) {
                try {
                    const detail = await api.get(`/assets/${asset.id}`);
                    const playbooks = detail.data.playbooks || [];
                    const sensors = detail.data.sensors || [];
                    pbCounts[asset.id] = playbooks.length;
                    snCounts[asset.id] = sensors.length;
                    setAssetPlaybooks(prev => ({ ...prev, [asset.id]: playbooks }));
                    setAssetSensors(prev => ({ ...prev, [asset.id]: sensors }));
                } catch {
                    pbCounts[asset.id] = 0;
                    snCounts[asset.id] = 0;
                }
            }
            setPlaybookCounts(pbCounts);
            setSensorCounts(snCounts);
        } catch { /* ignore */ }
        setLoading(false);
    };

    useEffect(() => { loadAssets(); }, [typeFilter]);

    const createAsset = async () => {
        await api.post('/assets', form);
        setShowCreate(false);
        setForm({ name: '', assetType: 'SERVER', ipAddress: '', hostname: '', operatingSystem: '', criticality: 'MEDIUM', owner: '', location: '', notes: '' });
        loadAssets();
    };

    const toggleExpand = async (assetId: string) => {
        if (expandedAssetId === assetId) {
            setExpandedAssetId(null);
            return;
        }
        setExpandedAssetId(assetId);
        // Load fresh playbook and sensor data
        try {
            const detail = await api.get(`/assets/${assetId}`);
            const playbooks = detail.data.playbooks || [];
            const sensors = detail.data.sensors || [];
            setAssetPlaybooks(prev => ({ ...prev, [assetId]: playbooks }));
            setAssetSensors(prev => ({ ...prev, [assetId]: sensors }));
            setPlaybookCounts(prev => ({ ...prev, [assetId]: playbooks.length }));
            setSensorCounts(prev => ({ ...prev, [assetId]: sensors.length }));
        } catch { /* ignore */ }
    };

    const openAssignPlaybookModal = async (assetId: string, assetName: string) => {
        try {
            const [pbList, detail] = await Promise.all([
                api.get('/playbooks').then(r => r.data),
                api.get(`/assets/${assetId}`).then(r => r.data),
            ]);
            setCompanyPlaybooks(pbList);
            const assigned = new Set<string>((detail.playbooks || []).map((p: LinkedPlaybook) => p.playbookId));
            setAssignedPlaybookIds(assigned);
            setAssignModal({ assetId, assetName });
            setPlaybookSearch('');
        } catch { /* ignore */ }
    };

    const togglePlaybookAssignment = async (playbookId: string) => {
        if (!assignModal) return;
        const { assetId } = assignModal;

        if (assignedPlaybookIds.has(playbookId)) {
            await api.delete(`/playbooks/assignments/${playbookId}/${assetId}`);
            setAssignedPlaybookIds(prev => {
                const next = new Set(prev);
                next.delete(playbookId);
                return next;
            });
        } else {
            await api.post('/playbooks/assignments', { playbookId, assetId, priority: 0 });
            setAssignedPlaybookIds(prev => new Set(prev).add(playbookId));
        }
    };

    const closeAssignModal = () => {
        setAssignModal(null);
        loadAssets();
    };

    const filteredPlaybooks = companyPlaybooks.filter(p =>
        !playbookSearch || p.name.toLowerCase().includes(playbookSearch.toLowerCase())
    );

    const filtered = assets.filter(a =>
        !filter || a.name.toLowerCase().includes(filter.toLowerCase()) ||
        a.ipAddress?.toLowerCase().includes(filter.toLowerCase()) ||
        a.hostname?.toLowerCase().includes(filter.toLowerCase())
    );

    const stats = {
        total: assets.length,
        active: assets.filter(a => a.status === 'ACTIVE').length,
        critical: assets.filter(a => a.criticality === 'CRITICAL').length,
    };

    if (loading) return <div className="p-6 text-slate-400">Loading assets...</div>;

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                        <Server className="w-6 h-6 text-blue-400" /> Asset Inventory
                    </h1>
                    <p className="text-slate-400 text-sm mt-1">{stats.total} assets | {stats.active} active | {stats.critical} critical</p>
                </div>
                <button
                    onClick={() => setShowCreate(true)}
                    className="flex items-center gap-2 bg-white text-black px-4 py-2 rounded-[2px] text-xs font-semibold uppercase tracking-wider hover:bg-slate-200 transition-colors"
                >
                    <Plus className="w-4 h-4" /> Add Asset
                </button>
            </div>

            {/* Filters */}
            <div className="flex gap-3">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                    <input
                        value={filter}
                        onChange={e => setFilter(e.target.value)}
                        className="w-full bg-slate-900/60 border border-slate-800 rounded-[2px] py-2 pl-9 pr-4 text-white text-sm"
                        placeholder="Search by name, IP, hostname..."
                    />
                </div>
                <select
                    value={typeFilter}
                    onChange={e => setTypeFilter(e.target.value)}
                    className="bg-slate-900/60 border border-slate-800 rounded-[2px] px-3 py-2 text-white text-sm"
                >
                    <option value="">All Types</option>
                    <option value="SERVER">Servers</option>
                    <option value="ENDPOINT">Endpoints</option>
                    <option value="NETWORK_DEVICE">Network</option>
                    <option value="APPLICATION">Applications</option>
                    <option value="DATABASE">Databases</option>
                    <option value="CLOUD_RESOURCE">Cloud</option>
                </select>
            </div>

            {/* Asset Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filtered.map(asset => (
                    <div key={asset.id} className="bg-slate-900/60 border border-slate-800 rounded-[2px] hover:border-slate-700 transition-colors">
                        <div className="p-5">
                            <div className="flex items-start gap-3 mb-3">
                                <div className="p-2 bg-slate-800 rounded-[2px] text-slate-400">
                                    {typeIcons[asset.assetType] || <Server className="w-5 h-5" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className="text-white font-semibold truncate">{asset.name}</h3>
                                    <p className="text-slate-500 text-xs">{asset.assetType.replace(/_/g, ' ')}</p>
                                </div>
                                <div className="flex flex-col items-end gap-1">
                                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-[2px] border ${criticalityColors[asset.criticality]}`}>
                                        {asset.criticality}
                                    </span>
                                    {(playbookCounts[asset.id] || 0) > 0 && (
                                        <span className="flex items-center gap-1 text-[10px] text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded-[2px]">
                                            <Shield className="w-3 h-3" /> {playbookCounts[asset.id]}
                                        </span>
                                    )}
                                    {(sensorCounts[asset.id] || 0) > 0 && (
                                        <span className="flex items-center gap-1 text-[10px] text-cyan-400 bg-cyan-500/10 px-1.5 py-0.5 rounded-[2px]">
                                            <Radio className="w-3 h-3" /> {sensorCounts[asset.id]}
                                        </span>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-1.5 text-xs text-slate-400">
                                {asset.ipAddress && <div className="flex justify-between"><span>IP</span><span className="text-white font-mono">{asset.ipAddress}</span></div>}
                                {asset.hostname && <div className="flex justify-between"><span>Host</span><span className="text-white">{asset.hostname}</span></div>}
                                {asset.operatingSystem && <div className="flex justify-between"><span>OS</span><span className="text-white">{asset.operatingSystem}</span></div>}
                                {asset.owner && <div className="flex justify-between"><span>Owner</span><span className="text-white">{asset.owner}</span></div>}
                            </div>

                            <div className="mt-3 pt-3 border-t border-slate-800 flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                    <StatusBadge status={asset.status} />
                                    {asset.location && <span className="text-[10px] text-slate-500">{asset.location}</span>}
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => openAssignPlaybookModal(asset.id, asset.name)}
                                        className="flex items-center gap-1 text-[10px] text-blue-400 hover:text-blue-300 transition-colors"
                                    >
                                        <Link2 className="w-3 h-3" /> Assign
                                    </button>
                                    <button
                                        onClick={() => toggleExpand(asset.id)}
                                        className="text-slate-500 hover:text-slate-300 transition-colors"
                                    >
                                        {expandedAssetId === asset.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Expanded playbook list */}
                        {expandedAssetId === asset.id && (
                            <div className="px-5 pb-4 border-t border-slate-800 pt-3">
                                <div className="text-[10px] text-slate-500 uppercase font-semibold mb-2">Assigned Playbooks</div>
                                {(!assetPlaybooks[asset.id] || assetPlaybooks[asset.id].length === 0) ? (
                                    <div className="text-xs text-slate-600 py-2">No playbooks assigned</div>
                                ) : (
                                    <div className="space-y-1.5">
                                        {assetPlaybooks[asset.id].map(pb => (
                                            <div key={pb.playbookId} className="flex items-center justify-between text-xs bg-slate-800/50 rounded-[2px] px-2.5 py-1.5">
                                                <div className="flex items-center gap-2">
                                                    <Shield className="w-3 h-3 text-blue-400" />
                                                    <span className="text-white">{pb.playbookName}</span>
                                                    {pb.category && (
                                                        <span className={`text-[9px] px-1.5 py-0 rounded-[1px] ${categoryColors[pb.category] || 'bg-slate-700 text-slate-400'}`}>
                                                            {pb.category.replace(/_/g, ' ')}
                                                        </span>
                                                    )}
                                                </div>
                                                <span className={`text-[10px] ${pb.isActive ? 'text-emerald-400' : 'text-slate-500'}`}>
                                                    {pb.isActive ? 'Active' : 'Inactive'}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Assigned Sensors */}
                                <div className="text-[10px] text-slate-500 uppercase font-semibold mb-2 mt-3">Sensores Asignados</div>
                                {(!assetSensors[asset.id] || assetSensors[asset.id].length === 0) ? (
                                    <div className="text-xs text-slate-600 py-2">No hay sensores asignados</div>
                                ) : (
                                    <div className="space-y-1.5">
                                        {assetSensors[asset.id].map(sn => (
                                            <div key={sn.sensorId} className="flex items-center justify-between text-xs bg-slate-800/50 rounded-[2px] px-2.5 py-1.5">
                                                <div className="flex items-center gap-2">
                                                    <Radio className="w-3 h-3 text-cyan-400" />
                                                    <span className="text-white">{sn.sensorName}</span>
                                                    {sn.category && (
                                                        <span className="text-[9px] px-1.5 py-0 rounded-[1px] bg-cyan-500/10 text-cyan-400">
                                                            {sn.category}
                                                        </span>
                                                    )}
                                                </div>
                                                <span className={`text-[10px] ${sn.isActive ? 'text-emerald-400' : 'text-slate-500'}`}>
                                                    {sn.isActive ? 'Activo' : 'Inactivo'}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {filtered.length === 0 && (
                <div className="text-center py-12 text-slate-500">No assets found</div>
            )}

            {/* Create Modal */}
            {showCreate && (
                <Modal isOpen={showCreate} title="Add Asset" onClose={() => setShowCreate(false)}>
                    <div className="space-y-3">
                        <div>
                            <label className="text-sm text-slate-300 block mb-1">Name *</label>
                            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                                className="w-full bg-slate-950 border border-slate-700 rounded-[2px] p-2 text-white text-sm" />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-sm text-slate-300 block mb-1">Type</label>
                                <select value={form.assetType} onChange={e => setForm(f => ({ ...f, assetType: e.target.value }))}
                                    className="w-full bg-slate-950 border border-slate-700 rounded-[2px] p-2 text-white text-sm">
                                    <option value="SERVER">Server</option>
                                    <option value="ENDPOINT">Endpoint</option>
                                    <option value="NETWORK_DEVICE">Network Device</option>
                                    <option value="APPLICATION">Application</option>
                                    <option value="DATABASE">Database</option>
                                    <option value="CLOUD_RESOURCE">Cloud Resource</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-sm text-slate-300 block mb-1">Criticality</label>
                                <select value={form.criticality} onChange={e => setForm(f => ({ ...f, criticality: e.target.value }))}
                                    className="w-full bg-slate-950 border border-slate-700 rounded-[2px] p-2 text-white text-sm">
                                    <option value="CRITICAL">Critical</option>
                                    <option value="HIGH">High</option>
                                    <option value="MEDIUM">Medium</option>
                                    <option value="LOW">Low</option>
                                </select>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-sm text-slate-300 block mb-1">IP Address</label>
                                <input value={form.ipAddress} onChange={e => setForm(f => ({ ...f, ipAddress: e.target.value }))}
                                    className="w-full bg-slate-950 border border-slate-700 rounded-[2px] p-2 text-white text-sm" placeholder="192.168.1.1" />
                            </div>
                            <div>
                                <label className="text-sm text-slate-300 block mb-1">Hostname</label>
                                <input value={form.hostname} onChange={e => setForm(f => ({ ...f, hostname: e.target.value }))}
                                    className="w-full bg-slate-950 border border-slate-700 rounded-[2px] p-2 text-white text-sm" />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-sm text-slate-300 block mb-1">OS</label>
                                <input value={form.operatingSystem} onChange={e => setForm(f => ({ ...f, operatingSystem: e.target.value }))}
                                    className="w-full bg-slate-950 border border-slate-700 rounded-[2px] p-2 text-white text-sm" />
                            </div>
                            <div>
                                <label className="text-sm text-slate-300 block mb-1">Owner</label>
                                <input value={form.owner} onChange={e => setForm(f => ({ ...f, owner: e.target.value }))}
                                    className="w-full bg-slate-950 border border-slate-700 rounded-[2px] p-2 text-white text-sm" />
                            </div>
                        </div>
                        <div>
                            <label className="text-sm text-slate-300 block mb-1">Location</label>
                            <input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                                className="w-full bg-slate-950 border border-slate-700 rounded-[2px] p-2 text-white text-sm" />
                        </div>
                        <button onClick={createAsset}
                            className="w-full bg-white text-black py-2 rounded-[2px] text-sm font-semibold hover:bg-slate-200 transition-colors">
                            Create Asset
                        </button>
                    </div>
                </Modal>
            )}

            {/* Assign Playbook Modal */}
            {assignModal && (
                <Modal isOpen={true} title={`Assign Playbooks: ${assignModal.assetName}`} onClose={closeAssignModal}>
                    <div className="space-y-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                            <input
                                value={playbookSearch}
                                onChange={e => setPlaybookSearch(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-700 rounded-[2px] py-2 pl-9 pr-4 text-white text-sm"
                                placeholder="Search playbooks..."
                            />
                        </div>

                        <div className="max-h-64 overflow-y-auto space-y-1">
                            {filteredPlaybooks.length === 0 ? (
                                <div className="text-center py-4 text-slate-500 text-sm">No playbooks available. Deploy templates first.</div>
                            ) : filteredPlaybooks.map(pb => (
                                <label
                                    key={pb.id}
                                    className={`flex items-center gap-3 p-2.5 rounded-[2px] cursor-pointer transition-colors ${
                                        assignedPlaybookIds.has(pb.id)
                                            ? 'bg-blue-500/10 border border-blue-500/30'
                                            : 'bg-slate-900 border border-slate-800 hover:border-slate-700'
                                    }`}
                                >
                                    <input
                                        type="checkbox"
                                        checked={assignedPlaybookIds.has(pb.id)}
                                        onChange={() => togglePlaybookAssignment(pb.id)}
                                        className="rounded-[2px]"
                                    />
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm text-white">{pb.name}</span>
                                            {pb.category && (
                                                <span className={`text-[9px] px-1.5 py-0 rounded-[1px] ${categoryColors[pb.category] || 'bg-slate-700 text-slate-400'}`}>
                                                    {pb.category.replace(/_/g, ' ')}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <span className={`text-[10px] ${pb.active ? 'text-emerald-400' : 'text-slate-500'}`}>
                                        {pb.active ? 'Active' : 'Inactive'}
                                    </span>
                                </label>
                            ))}
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                            <span className="text-xs text-slate-400">{assignedPlaybookIds.size} playbook{assignedPlaybookIds.size !== 1 ? 's' : ''} assigned</span>
                            <button
                                onClick={closeAssignModal}
                                className="bg-white text-black px-4 py-2 rounded-[2px] text-sm font-semibold hover:bg-slate-200 transition-colors"
                            >
                                Done
                            </button>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default Assets;
