import React, { useCallback, useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    ReactFlow,
    Controls,
    Background,
    addEdge,
    applyNodeChanges,
    applyEdgeChanges,
    type Node,
    type Edge,
    type OnNodesChange,
    type OnEdgesChange,
    type OnConnect,
    type NodeTypes,
    Handle,
    Position,
    MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { ArrowLeft, Save, Plus, Trash2, Shield, Zap, Bell, Search, Globe, MessageSquare, Webhook, GitBranch, Clock } from 'lucide-react';
import { playbookService } from '../lib/services';
import clsx from 'clsx';

const ACTION_TYPES = [
    { type: 'BLOCK_IP', label: 'Block IP', icon: Shield, color: 'bg-red-500/20 border-red-500/40 text-red-400' },
    { type: 'CREATE_INCIDENT', label: 'Create Incident', icon: Zap, color: 'bg-orange-500/20 border-orange-500/40 text-orange-400' },
    { type: 'SEND_ALERT', label: 'Send Alert', icon: Bell, color: 'bg-yellow-500/20 border-yellow-500/40 text-yellow-400' },
    { type: 'ENRICH_IP', label: 'Enrich IP', icon: Search, color: 'bg-blue-500/20 border-blue-500/40 text-blue-400' },
    { type: 'NOTIFY_SLACK', label: 'Notify Slack', icon: MessageSquare, color: 'bg-purple-500/20 border-purple-500/40 text-purple-400' },
    { type: 'WEBHOOK_CALL', label: 'Webhook', icon: Webhook, color: 'bg-cyan-500/20 border-cyan-500/40 text-cyan-400' },
    { type: 'UPDATE_STATUS', label: 'Update Status', icon: Globe, color: 'bg-green-500/20 border-green-500/40 text-green-400' },
    { type: 'CONDITION', label: 'Condition', icon: GitBranch, color: 'bg-amber-500/20 border-amber-500/40 text-amber-400' },
    { type: 'DELAY', label: 'Delay', icon: Clock, color: 'bg-slate-500/20 border-slate-500/40 text-slate-400' },
];

const getActionMeta = (actionType: string) => ACTION_TYPES.find(a => a.type === actionType) || ACTION_TYPES[0];

// Custom node component
const ActionNode: React.FC<{ data: { label: string; actionType: string; description: string } }> = ({ data }) => {
    const meta = getActionMeta(data.actionType);
    const Icon = meta.icon;

    return (
        <div className={clsx('px-4 py-3 rounded-[2px] border min-w-[180px] shadow-lg', meta.color)}>
            <Handle type="target" position={Position.Top} className="!w-3 !h-3 !bg-slate-500 !border-slate-400" />
            <div className="flex items-center gap-2 mb-1">
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span className="text-xs font-bold uppercase tracking-wider">{meta.label}</span>
            </div>
            {data.description && (
                <p className="text-[11px] opacity-70 mt-1 line-clamp-2">{data.description}</p>
            )}
            <Handle type="source" position={Position.Bottom} className="!w-3 !h-3 !bg-slate-500 !border-slate-400" />
            {data.actionType === 'CONDITION' && (
                <>
                    <Handle type="source" position={Position.Left} id="false" className="!w-3 !h-3 !bg-red-500 !border-red-400" />
                    <Handle type="source" position={Position.Right} id="true" className="!w-3 !h-3 !bg-green-500 !border-green-400" />
                </>
            )}
        </div>
    );
};

const PlaybookBuilder: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [nodes, setNodes] = useState<Node[]>([]);
    const [edges, setEdges] = useState<Edge[]>([]);
    const [playbookName, setPlaybookName] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [selectedNode, setSelectedNode] = useState<string | null>(null);
    const [showAddPanel, setShowAddPanel] = useState(false);

    const nodeTypes: NodeTypes = useMemo(() => ({
        action: ActionNode,
    }), []);

    useEffect(() => {
        if (!id) return;
        const loadGraph = async () => {
            try {
                const [detail, graph] = await Promise.all([
                    playbookService.getDetail(id),
                    playbookService.getGraph(id),
                ]);
                setPlaybookName(detail.name);

                const loadedNodes: Node[] = (graph.nodes || []).map((n: Record<string, unknown>) => ({
                    id: n.id as string,
                    type: 'action',
                    position: { x: (n.positionX as number) || 0, y: (n.positionY as number) || 0 },
                    data: {
                        label: n.actionType as string,
                        actionType: n.actionType as string,
                        description: (n.description as string) || '',
                        actionConfig: (n.actionConfig as string) || '',
                    },
                }));

                const loadedEdges: Edge[] = (graph.edges || []).map((e: Record<string, unknown>) => ({
                    id: e.id as string,
                    source: e.source as string,
                    target: e.target as string,
                    label: (e.label as string) || undefined,
                    type: 'smoothstep',
                    animated: true,
                    markerEnd: { type: MarkerType.ArrowClosed, color: '#64748b' },
                    style: { stroke: '#64748b' },
                }));

                setNodes(loadedNodes);
                setEdges(loadedEdges);
            } catch (err) {
                console.error('Failed to load graph:', err);
            } finally {
                setLoading(false);
            }
        };
        loadGraph();
    }, [id]);

    const onNodesChange: OnNodesChange = useCallback(
        (changes) => setNodes((nds) => applyNodeChanges(changes, nds)),
        []
    );

    const onEdgesChange: OnEdgesChange = useCallback(
        (changes) => setEdges((eds) => applyEdgeChanges(changes, eds)),
        []
    );

    const onConnect: OnConnect = useCallback(
        (connection) => setEdges((eds) => addEdge({
            ...connection,
            type: 'smoothstep',
            animated: true,
            markerEnd: { type: MarkerType.ArrowClosed, color: '#64748b' },
            style: { stroke: '#64748b' },
        }, eds)),
        []
    );

    const handleAddNode = (actionType: string) => {
        const newId = crypto.randomUUID();
        const meta = getActionMeta(actionType);
        const newNode: Node = {
            id: newId,
            type: 'action',
            position: { x: 250 + Math.random() * 200, y: 100 + nodes.length * 120 },
            data: {
                label: meta.label,
                actionType,
                description: '',
                actionConfig: '',
            },
        };
        setNodes((nds) => [...nds, newNode]);
        setShowAddPanel(false);
        setSelectedNode(newId);
    };

    const handleDeleteNode = () => {
        if (!selectedNode) return;
        setNodes((nds) => nds.filter(n => n.id !== selectedNode));
        setEdges((eds) => eds.filter(e => e.source !== selectedNode && e.target !== selectedNode));
        setSelectedNode(null);
    };

    const handleSave = async () => {
        if (!id) return;
        setSaving(true);
        try {
            const graphData = {
                nodes: nodes.map(n => ({
                    id: n.id,
                    actionType: n.data.actionType,
                    description: n.data.description || '',
                    actionConfig: n.data.actionConfig || '',
                    nodeType: n.data.actionType === 'CONDITION' ? 'condition' : 'action',
                    positionX: n.position.x,
                    positionY: n.position.y,
                })),
                edges: edges.map(e => ({
                    id: e.id,
                    source: e.source,
                    target: e.target,
                    label: e.label || '',
                    type: 'default',
                })),
            };
            await playbookService.saveGraph(id, graphData);
        } catch (err) {
            console.error('Save failed:', err);
        } finally {
            setSaving(false);
        }
    };

    const updateSelectedNodeData = (key: string, value: string) => {
        if (!selectedNode) return;
        setNodes((nds) => nds.map(n => {
            if (n.id === selectedNode) {
                return { ...n, data: { ...n.data, [key]: value } };
            }
            return n;
        }));
    };

    const selectedNodeData = nodes.find(n => n.id === selectedNode);

    if (loading) {
        return <div className="p-8 text-slate-400">Loading builder...</div>;
    }

    return (
        <div className="h-[calc(100vh-7rem)] flex flex-col">
            {/* Toolbar */}
            <div className="flex items-center justify-between px-4 py-3 bg-slate-800/50 border-b border-slate-700/50">
                <div className="flex items-center gap-3">
                    <button onClick={() => navigate('/playbooks')} className="text-slate-400 hover:text-white transition-colors">
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <h1 className="text-lg font-semibold text-white">{playbookName}</h1>
                    <span className="text-xs text-slate-500">Visual Builder</span>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setShowAddPanel(!showAddPanel)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-[2px] text-sm transition-colors"
                    >
                        <Plus className="w-4 h-4" /> Add Step
                    </button>
                    {selectedNode && (
                        <button
                            onClick={handleDeleteNode}
                            className="flex items-center gap-1 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-[2px] text-sm transition-colors"
                        >
                            <Trash2 className="w-4 h-4" /> Delete
                        </button>
                    )}
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex items-center gap-1 px-4 py-1.5 bg-white hover:bg-[#E0E0E0] text-black rounded-[2px] text-sm font-medium transition-colors disabled:opacity-50"
                    >
                        <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save'}
                    </button>
                </div>
            </div>

            <div className="flex-1 flex">
                {/* Canvas */}
                <div className="flex-1">
                    <ReactFlow
                        nodes={nodes}
                        edges={edges}
                        onNodesChange={onNodesChange}
                        onEdgesChange={onEdgesChange}
                        onConnect={onConnect}
                        nodeTypes={nodeTypes}
                        onNodeClick={(_, node) => setSelectedNode(node.id)}
                        onPaneClick={() => setSelectedNode(null)}
                        fitView
                        proOptions={{ hideAttribution: true }}
                        style={{ backgroundColor: '#0f172a' }}
                    >
                        <Controls className="!bg-slate-800 !border-slate-700 !rounded-[2px] [&>button]:!bg-slate-800 [&>button]:!border-slate-700 [&>button]:!text-white [&>button:hover]:!bg-slate-700" />
                        <Background color="#1e293b" gap={20} />
                    </ReactFlow>
                </div>

                {/* Side Panel — Add Steps or Edit Node */}
                {showAddPanel && (
                    <div className="w-64 bg-slate-800/80 border-l border-slate-700/50 p-4 overflow-y-auto">
                        <h3 className="text-sm font-semibold text-white mb-3">Add Step</h3>
                        <div className="space-y-2">
                            {ACTION_TYPES.map(action => {
                                const Icon = action.icon;
                                return (
                                    <button
                                        key={action.type}
                                        onClick={() => handleAddNode(action.type)}
                                        className={clsx(
                                            'w-full flex items-center gap-2 px-3 py-2 rounded-[2px] border text-left text-sm transition-colors hover:opacity-80',
                                            action.color
                                        )}
                                    >
                                        <Icon className="w-4 h-4 flex-shrink-0" />
                                        {action.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                {selectedNodeData && !showAddPanel && (
                    <div className="w-72 bg-slate-800/80 border-l border-slate-700/50 p-4 overflow-y-auto">
                        <h3 className="text-sm font-semibold text-white mb-3">Edit Step</h3>
                        <div className="space-y-3">
                            <div>
                                <label className="text-xs text-slate-400 block mb-1">Type</label>
                                <select
                                    value={selectedNodeData.data.actionType as string}
                                    onChange={e => updateSelectedNodeData('actionType', e.target.value)}
                                    className="w-full bg-slate-900 border border-slate-700 rounded-[2px] px-3 py-2 text-white text-sm"
                                >
                                    {ACTION_TYPES.map(a => (
                                        <option key={a.type} value={a.type}>{a.label}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="text-xs text-slate-400 block mb-1">Description</label>
                                <textarea
                                    value={(selectedNodeData.data.description as string) || ''}
                                    onChange={e => updateSelectedNodeData('description', e.target.value)}
                                    className="w-full bg-slate-900 border border-slate-700 rounded-[2px] px-3 py-2 text-white text-sm"
                                    rows={3}
                                    placeholder="Step description..."
                                />
                            </div>
                            <div>
                                <label className="text-xs text-slate-400 block mb-1">Config (JSON)</label>
                                <textarea
                                    value={(selectedNodeData.data.actionConfig as string) || ''}
                                    onChange={e => updateSelectedNodeData('actionConfig', e.target.value)}
                                    className="w-full bg-slate-900 border border-slate-700 rounded-[2px] px-3 py-2 text-white text-sm font-mono"
                                    rows={4}
                                    placeholder='{"duration_hours": 24}'
                                />
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PlaybookBuilder;
