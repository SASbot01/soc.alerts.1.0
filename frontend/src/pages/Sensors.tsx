import React, { useEffect, useState } from 'react';
import { Radio, SignalHigh, CircleOff, RefreshCw, Download, CheckCircle, Search, Link2, Trash2, Wifi, Monitor, Globe, ChevronDown, ChevronRight, Terminal, Eye } from 'lucide-react';
import api from '../lib/api';
import Modal from '../components/Modal';

interface Sensor {
    id: string;
    name: string;
    companyId: string;
    status: string;
    sensorType: string | null;
    category: string | null;
    description: string | null;
    detectedThreats: string | null;
    targetAssetTypes: string | null;
    icon: string | null;
    configInstructions: string | null;
    setupCommand: string | null;
    sourceTemplateId: string | null;
    isTemplate: boolean | null;
    registeredAt: string;
    lastSeen: string;
    packetsProcessed: number;
    threatsDetected: number;
}

interface SensorTemplate {
    id: string;
    name: string;
    description: string;
    sensorType: string;
    category: string;
    detectedThreats: string;
    targetAssetTypes: string;
    icon: string;
    configInstructions: string;
    setupCommand: string;
    alreadyDeployed: boolean;
    deployedSensorId: string | null;
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
    sensorId: string;
    isActive: boolean;
}

const categoryColors: Record<string, string> = {
    NETWORK: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    ENDPOINT: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    DECEPTION: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    WEB: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
};

const categoryIcons: Record<string, React.ReactNode> = {
    NETWORK: <Wifi className="w-8 h-8" />,
    ENDPOINT: <Monitor className="w-8 h-8" />,
    DECEPTION: <Eye className="w-8 h-8" />,
    WEB: <Globe className="w-8 h-8" />,
};

const Sensors: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'my' | 'catalog'>('catalog');
    const [sensors, setSensors] = useState<Sensor[]>([]);
    const [catalog, setCatalog] = useState<SensorTemplate[]>([]);
    const [loading, setLoading] = useState(true);
    const [deploying, setDeploying] = useState<string | null>(null);
    const [expandedTemplate, setExpandedTemplate] = useState<string | null>(null);

    // Assignment modal
    const [assignModal, setAssignModal] = useState<{ sensorId: string; sensorName: string } | null>(null);
    const [assets, setAssets] = useState<Asset[]>([]);
    const [assignedAssetIds, setAssignedAssetIds] = useState<Set<string>>(new Set());
    const [selectedAssetIds, setSelectedAssetIds] = useState<Set<string>>(new Set());
    const [assetSearch, setAssetSearch] = useState('');

    const loadData = async () => {
        setLoading(true);
        try {
            const [sensorList, catalogList] = await Promise.all([
                api.get('/sensors').then(r => r.data),
                api.get('/sensors/catalog').then(r => r.data),
            ]);
            setSensors(sensorList.filter((s: Sensor) => !s.isTemplate));
            setCatalog(catalogList);
        } catch { /* ignore */ }
        setLoading(false);
    };

    useEffect(() => { loadData(); }, []);

    const deploySensor = async (templateId: string) => {
        setDeploying(templateId);
        try {
            await api.post('/sensors/catalog/deploy', { templateId });
            await loadData();
        } catch { /* ignore */ }
        setDeploying(null);
    };

    const removeSensor = async (sensorId: string) => {
        try {
            await api.delete(`/sensors/${sensorId}`);
            await loadData();
        } catch { /* ignore */ }
    };

    const openAssignModal = async (sensorId: string, sensorName: string) => {
        try {
            const [assetList, assignments] = await Promise.all([
                api.get('/assets').then(r => r.data),
                api.get(`/sensors/${sensorId}/assignments`).then(r => r.data),
            ]);
            setAssets(assetList);
            const assigned = new Set<string>((assignments as Assignment[]).map((a: Assignment) => a.assetId));
            setAssignedAssetIds(assigned);
            setSelectedAssetIds(new Set(assigned));
            setAssignModal({ sensorId, sensorName });
            setAssetSearch('');
        } catch { /* ignore */ }
    };

    const saveAssignments = async () => {
        if (!assignModal) return;
        const { sensorId } = assignModal;

        for (const assetId of assignedAssetIds) {
            if (!selectedAssetIds.has(assetId)) {
                await api.delete(`/sensors/assignments/${sensorId}/${assetId}`);
            }
        }

        const newIds = [...selectedAssetIds].filter(id => !assignedAssetIds.has(id));
        if (newIds.length > 0) {
            await api.post('/sensors/assignments/bulk', { sensorId, assetIds: newIds });
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

    const parseConfig = (json: string) => {
        try { return JSON.parse(json); } catch { return null; }
    };

    if (loading) {
        return (
            <div className="space-y-6 p-6">
                <h1 className="text-2xl font-bold text-white">Network Sensors</h1>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {[...Array(4)].map((_, i) => (
                        <div key={i} className="bg-slate-800/50 border border-slate-700/50 rounded-[2px] p-6 animate-pulse">
                            <div className="h-12 w-12 bg-slate-700 rounded-[2px] mb-6" />
                            <div className="space-y-3">
                                <div className="h-4 bg-slate-700 rounded w-3/4" />
                                <div className="h-4 bg-slate-700 rounded w-1/2" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    const tabs = [
        { key: 'catalog' as const, label: 'Catalogo de Sensores', count: catalog.length },
        { key: 'my' as const, label: 'Mis Sensores', count: sensors.length },
    ];

    return (
        <div className="space-y-6 p-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                        <Radio className="w-6 h-6 text-blue-400" /> Sensores de Seguridad
                    </h1>
                    <p className="text-slate-400 text-sm mt-1">Despliega y configura sensores para proteger tus assets</p>
                </div>
                <button onClick={loadData} className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-[2px] text-sm text-slate-300 transition-colors">
                    <RefreshCw className="w-4 h-4" /> Refresh
                </button>
            </div>

            {/* Agent Download Banner */}
            <div className="bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-cyan-500/10 border border-blue-500/20 rounded-[2px] p-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-blue-500/20 rounded-[2px]">
                            <Monitor className="w-8 h-8 text-blue-400" />
                        </div>
                        <div>
                            <h3 className="text-white font-bold flex items-center gap-2">
                                BlackWolf SOC Agent <span className="text-[10px] px-2 py-0.5 bg-green-500/20 text-green-400 border border-green-500/30 rounded-[2px]">v1.0</span>
                            </h3>
                            <p className="text-slate-400 text-sm mt-0.5">
                                Agente EDR ligero para Linux — FIM, monitoreo de procesos, deteccion de shells inversas, anomalias de red
                            </p>
                            <div className="flex gap-3 mt-1">
                                {['File Integrity', 'Auth Monitoring', 'Process Monitoring', 'Network C2 Detection', 'System Health'].map(cap => (
                                    <span key={cap} className="text-[10px] text-slate-500 bg-slate-800/50 px-1.5 py-0.5 rounded-[2px]">{cap}</span>
                                ))}
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={() => {
                            api.get('/agent/download', { responseType: 'blob' }).then(r => {
                                const url = window.URL.createObjectURL(new Blob([r.data]));
                                const a = document.createElement('a');
                                a.href = url;
                                a.download = 'blackwolf-agent.zip';
                                document.body.appendChild(a);
                                a.click();
                                a.remove();
                            });
                        }}
                        className="flex items-center gap-2 px-5 py-3 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 border border-blue-500/30 rounded-[2px] text-sm font-medium transition-colors whitespace-nowrap"
                    >
                        <Download className="w-5 h-5" /> Descargar Agente
                    </button>
                </div>
            </div>

            {/* Tab Navigation */}
            <div className="flex gap-1 border-b border-slate-800">
                {tabs.map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className={`px-4 py-2.5 text-sm font-medium transition-colors relative ${
                            activeTab === tab.key ? 'text-white' : 'text-slate-500 hover:text-slate-300'
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

            {/* Sensor Catalog Tab */}
            {activeTab === 'catalog' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {catalog.map(tpl => {
                        const config = parseConfig(tpl.configInstructions);
                        return (
                            <div key={tpl.id} className="bg-slate-900/60 border border-slate-800 rounded-[2px] hover:border-slate-700 transition-colors">
                                <div className="p-6">
                                    <div className="flex items-start gap-4 mb-4">
                                        <div className={`p-3 rounded-[2px] ${categoryColors[tpl.category] || 'bg-slate-800 text-slate-400'}`}>
                                            {categoryIcons[tpl.category] || <Radio className="w-8 h-8" />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className={`px-2 py-0.5 rounded-[2px] text-[10px] uppercase font-bold border ${categoryColors[tpl.category] || 'bg-slate-800 text-slate-400 border-slate-700'}`}>
                                                    {tpl.category}
                                                </span>
                                                <span className="text-[10px] text-slate-500 font-mono">{tpl.sensorType}</span>
                                            </div>
                                            <h3 className="text-white font-semibold text-lg">{tpl.name}</h3>
                                        </div>
                                    </div>

                                    <p className="text-slate-400 text-sm mb-4 leading-relaxed">{tpl.description}</p>

                                    {/* Detected threats */}
                                    <div className="mb-3">
                                        <div className="text-[10px] text-slate-500 uppercase font-semibold mb-1.5">Amenazas que detecta</div>
                                        <div className="flex gap-1 flex-wrap">
                                            {tpl.detectedThreats.split(',').map(t => (
                                                <span key={t} className="text-[9px] px-1.5 py-0.5 bg-red-500/10 text-red-400 rounded-[2px] font-mono">
                                                    {t.trim().replace(/_/g, ' ')}
                                                </span>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Target asset types */}
                                    <div className="mb-3">
                                        <div className="text-[10px] text-slate-500 uppercase font-semibold mb-1.5">Assets compatibles</div>
                                        <div className="flex gap-1 flex-wrap">
                                            {tpl.targetAssetTypes.split(',').map(t => (
                                                <span key={t} className="text-[9px] px-1.5 py-0.5 bg-slate-800 text-slate-400 rounded-[2px]">
                                                    {t.trim().replace(/_/g, ' ')}
                                                </span>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Expand config */}
                                    <button
                                        onClick={() => setExpandedTemplate(expandedTemplate === tpl.id ? null : tpl.id)}
                                        className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 transition-colors mb-3"
                                    >
                                        {expandedTemplate === tpl.id ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                        Instrucciones de configuracion
                                    </button>

                                    {expandedTemplate === tpl.id && config && (
                                        <div className="space-y-3 mb-3 p-3 bg-slate-950/50 rounded-[2px] border border-slate-800">
                                            {config.steps && (
                                                <div>
                                                    <div className="text-[10px] text-slate-500 uppercase font-semibold mb-1">Pasos</div>
                                                    <ol className="text-xs text-slate-300 space-y-1 pl-4 list-decimal">
                                                        {config.steps.map((step: string, i: number) => (
                                                            <li key={i}>{step}</li>
                                                        ))}
                                                    </ol>
                                                </div>
                                            )}
                                            {config.env_vars && (
                                                <div>
                                                    <div className="text-[10px] text-slate-500 uppercase font-semibold mb-1">Variables de entorno</div>
                                                    <div className="space-y-0.5">
                                                        {config.env_vars.map((v: string, i: number) => (
                                                            <div key={i} className="text-[11px] font-mono text-emerald-400 bg-slate-900 px-2 py-0.5 rounded-[1px]">{v}</div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                            {config.requires && (
                                                <div>
                                                    <div className="text-[10px] text-slate-500 uppercase font-semibold mb-1">Requisitos</div>
                                                    <div className="text-xs text-yellow-400">{config.requires}</div>
                                                </div>
                                            )}
                                            {config.ports && (
                                                <div>
                                                    <div className="text-[10px] text-slate-500 uppercase font-semibold mb-1">Puertos</div>
                                                    <div className="flex gap-2">
                                                        {config.ports.map((p: string, i: number) => (
                                                            <span key={i} className="text-[11px] font-mono text-blue-400">{p}</span>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                            {tpl.setupCommand && (
                                                <div>
                                                    <div className="text-[10px] text-slate-500 uppercase font-semibold mb-1">Comando de despliegue</div>
                                                    <div className="flex items-center gap-2 bg-slate-900 px-3 py-2 rounded-[2px] border border-slate-700">
                                                        <Terminal className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                                                        <code className="text-sm text-emerald-400 font-mono">{tpl.setupCommand}</code>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                <div className="px-6 py-4 border-t border-slate-800 flex items-center justify-between">
                                    {tpl.alreadyDeployed ? (
                                        <span className="flex items-center gap-1.5 text-xs text-emerald-400">
                                            <CheckCircle className="w-3.5 h-3.5" /> Desplegado
                                        </span>
                                    ) : (
                                        <button
                                            onClick={() => deploySensor(tpl.id)}
                                            disabled={deploying === tpl.id}
                                            className="flex items-center gap-1.5 text-xs font-semibold text-white bg-white/10 hover:bg-white/20 px-4 py-2 rounded-[2px] transition-colors disabled:opacity-50"
                                        >
                                            <Download className="w-3.5 h-3.5" />
                                            {deploying === tpl.id ? 'Desplegando...' : 'Desplegar Sensor'}
                                        </button>
                                    )}
                                    {tpl.alreadyDeployed && (
                                        <button
                                            onClick={() => openAssignModal(tpl.deployedSensorId!, tpl.name)}
                                            className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
                                        >
                                            <Link2 className="w-3 h-3" /> Asignar a Assets
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* My Sensors Tab */}
            {activeTab === 'my' && (
                <>
                    {sensors.length === 0 ? (
                        <div className="text-center py-16 text-slate-500">
                            <Radio className="w-12 h-12 mx-auto mb-3 opacity-30" />
                            <p className="text-lg">No tienes sensores desplegados</p>
                            <p className="text-sm mt-1">Ve al Catalogo de Sensores para desplegar tus primeros sensores</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {sensors.map((sensor) => (
                                <div key={sensor.id} className="bg-slate-800/50 border border-slate-700/50 rounded-[2px] p-6 relative overflow-hidden group hover:border-slate-600 transition-all">
                                    <div className="absolute top-0 right-0 p-4">
                                        {sensor.status === 'online' ? (
                                            <SignalHigh className="w-5 h-5 text-green-500" />
                                        ) : sensor.status === 'pending' ? (
                                            <div className="flex items-center gap-1">
                                                <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
                                                <span className="text-[10px] text-yellow-400">Pendiente</span>
                                            </div>
                                        ) : (
                                            <CircleOff className="w-5 h-5 text-slate-600" />
                                        )}
                                    </div>

                                    <div className="flex items-center gap-4 mb-4">
                                        <div className={`w-12 h-12 rounded-[2px] flex items-center justify-center border ${
                                            sensor.category ? categoryColors[sensor.category] || 'bg-slate-900 border-slate-700 text-slate-400' : 'bg-slate-900 border-slate-700 text-slate-400'
                                        }`}>
                                            {sensor.category ? (categoryIcons[sensor.category] || <Radio className="w-6 h-6" />) : <Radio className="w-6 h-6" />}
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-semibold text-white">{sensor.name || sensor.id}</h3>
                                            {sensor.category && (
                                                <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded-[2px] border ${categoryColors[sensor.category] || ''}`}>
                                                    {sensor.category}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {sensor.description && (
                                        <p className="text-xs text-slate-500 mb-4 line-clamp-2">{sensor.description}</p>
                                    )}

                                    <div className="space-y-2">
                                        <div className="flex justify-between text-sm">
                                            <span className="text-slate-400">Estado</span>
                                            <span className={`${
                                                sensor.status === 'online' ? 'text-green-400' :
                                                sensor.status === 'pending' ? 'text-yellow-400' :
                                                'text-slate-500'
                                            } font-medium capitalize`}>
                                                {sensor.status === 'pending' ? 'Pendiente de conexion' : sensor.status}
                                            </span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-slate-400">Amenazas</span>
                                            <span className="text-white font-medium">{sensor.threatsDetected || 0}</span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-slate-400">Paquetes</span>
                                            <span className="text-white font-medium">{((sensor.packetsProcessed || 0) / 1000).toFixed(1)}k</span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-slate-400">Ultima actividad</span>
                                            <span className="text-slate-500">{sensor.lastSeen ? new Date(sensor.lastSeen).toLocaleString() : 'Sin conexion'}</span>
                                        </div>
                                    </div>

                                    {sensor.detectedThreats && (
                                        <div className="mt-3 pt-3 border-t border-slate-700/50">
                                            <div className="flex gap-1 flex-wrap">
                                                {sensor.detectedThreats.split(',').slice(0, 4).map(t => (
                                                    <span key={t} className="text-[8px] px-1 py-0 bg-red-500/10 text-red-400 rounded-[1px] font-mono">
                                                        {t.trim().replace(/_/g, ' ')}
                                                    </span>
                                                ))}
                                                {sensor.detectedThreats.split(',').length > 4 && (
                                                    <span className="text-[8px] text-slate-500">+{sensor.detectedThreats.split(',').length - 4}</span>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    <div className="mt-3 pt-3 border-t border-slate-700/50 flex items-center justify-between">
                                        <button
                                            onClick={() => openAssignModal(sensor.id, sensor.name || sensor.id)}
                                            className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
                                        >
                                            <Link2 className="w-3 h-3" /> Asignar Assets
                                        </button>
                                        <button
                                            onClick={() => removeSensor(sensor.id)}
                                            className="flex items-center gap-1 text-xs text-red-400/60 hover:text-red-400 transition-colors"
                                        >
                                            <Trash2 className="w-3 h-3" /> Quitar
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </>
            )}

            {/* Assign Assets Modal */}
            {assignModal && (
                <Modal isOpen={true} title={`Asignar Assets: ${assignModal.sensorName}`} onClose={() => setAssignModal(null)}>
                    <div className="space-y-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                            <input
                                value={assetSearch}
                                onChange={e => setAssetSearch(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-700 rounded-[2px] py-2 pl-9 pr-4 text-white text-sm"
                                placeholder="Buscar assets..."
                            />
                        </div>

                        <div className="max-h-64 overflow-y-auto space-y-1">
                            {filteredAssets.length === 0 ? (
                                <div className="text-center py-4 text-slate-500 text-sm">No hay assets. Crea assets primero.</div>
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
                            <span className="text-xs text-slate-400">{selectedAssetIds.size} asset{selectedAssetIds.size !== 1 ? 's' : ''} seleccionados</span>
                            <button
                                onClick={saveAssignments}
                                className="bg-white text-black px-4 py-2 rounded-[2px] text-sm font-semibold hover:bg-slate-200 transition-colors"
                            >
                                Guardar
                            </button>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default Sensors;
