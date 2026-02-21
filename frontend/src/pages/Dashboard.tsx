import React, { useEffect, useState, useCallback } from 'react';
import api from '../lib/api';
import { ShieldAlert, Radio, Activity, Globe, ArrowUpRight, Download, FileText } from 'lucide-react';
import { reportService } from '../lib/services';
import RiskScoreGauge from '../components/RiskScoreGauge';
import ThreatMap from '../components/ThreatMap';
import AiAgentConsole from '../components/AiAgentConsole';
import { useSseEvents } from '../hooks/useSseEvents';
import { useAuth } from '../context/AuthContext';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const Dashboard: React.FC = () => {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [mapRefresh, setMapRefresh] = useState(0);
    const { user } = useAuth();

    const fetchData = useCallback(async () => {
        try {
            const res = await api.get('/dashboard/overview');
            setData(res.data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    }, []);

    // SSE: refresh dashboard + map on new threats/incidents
    useSseEvents({
        companyId: user?.companyId || null,
        onThreat: useCallback(() => {
            fetchData();
            setMapRefresh(prev => prev + 1);
        }, [fetchData]),
        onIncident: useCallback(() => { fetchData(); }, [fetchData]),
        onDashboardUpdate: useCallback(() => { fetchData(); }, [fetchData]),
    });

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 30000);
        return () => clearInterval(interval);
    }, [fetchData]);

    if (loading) return <div className="p-8 text-slate-400">Loading dashboard data...</div>;
    if (!data) return <div className="p-8 text-red-400">Failed to load data.</div>;

    const stats = [
        { label: 'Total Threats', value: data.stats.total_threats, icon: ShieldAlert, color: 'text-red-400', bg: 'bg-red-400/10' },
        { label: 'Active Sensors', value: data.stats.active_sensors, icon: Radio, color: 'text-green-400', bg: 'bg-green-400/10' },
        { label: 'Threats Today', value: data.stats.threats_today, icon: Activity, color: 'text-yellow-400', bg: 'bg-yellow-400/10' },
        { label: 'Blocked IPs', value: data.stats.blocked_ips, icon: Globe, color: 'text-blue-400', bg: 'bg-blue-400/10' },
    ];

    // Transform distribution for chart
    const chartData = Object.entries(data.attack_distribution || {}).map(([name, value]) => ({ name, value }));

    return (
        <div className="space-y-6">
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white mb-1">Security Overview</h1>
                    <p className="text-slate-400">Real-time threat monitoring for <span className="text-primary-400 font-medium">{data.company.name}</span></p>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => reportService.downloadExecutivePDF()} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-300 rounded-[2px] text-sm transition-colors">
                        <FileText className="w-4 h-4" /> PDF Report
                    </button>
                    <button onClick={() => reportService.downloadThreatsCSV()} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-300 rounded-[2px] text-sm transition-colors">
                        <Download className="w-4 h-4" /> CSV
                    </button>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {stats.map((stat, idx) => (
                    <div key={idx} className="bg-slate-800/50 border border-slate-700/50 p-4 rounded-[2px] backdrop-blur-sm hover:bg-slate-800/70 transition-colors">
                        <div className="flex justify-between items-start mb-4">
                            <div className={`p-2 rounded-[2px] ${stat.bg} ${stat.color}`}>
                                <stat.icon className="w-6 h-6" />
                            </div>
                            <span className="flex items-center text-xs font-medium text-slate-500 bg-slate-900/50 px-2 py-1 rounded-full">
                                Live <div className="w-1.5 h-1.5 rounded-full bg-green-500 ml-1 animate-pulse" />
                            </span>
                        </div>
                        <div className="text-3xl font-bold text-white mb-1">{stat.value}</div>
                        <div className="text-sm text-slate-400">{stat.label}</div>
                    </div>
                ))}
            </div>

            {/* Risk Score */}
            <RiskScoreGauge />

            {/* Threat Map */}
            <ThreatMap refreshTrigger={mapRefresh} />

            {/* AI Agent Console */}
            <AiAgentConsole />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Chart */}
                <div className="lg:col-span-2 bg-slate-800/50 border border-slate-700/50 rounded-[2px] p-6 backdrop-blur-sm">
                    <h3 className="text-lg font-semibold text-white mb-6">Threat Distribution</h3>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData}>
                                <defs>
                                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#ffffff" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#ffffff" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#333333" />
                                <XAxis dataKey="name" stroke="#999999" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis stroke="#999999" fontSize={12} tickLine={false} axisLine={false} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#1A1A1A', borderColor: '#333333', color: '#ffffff' }}
                                    itemStyle={{ color: '#E0E0E0' }}
                                />
                                <Area type="monotone" dataKey="value" stroke="#ffffff" strokeWidth={3} fillOpacity={1} fill="url(#colorValue)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Recent Threats */}
                <div className="bg-slate-800/50 border border-slate-700/50 rounded-[2px] p-6 backdrop-blur-sm overflow-hidden">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-lg font-semibold text-white">Recent Threats</h3>
                        <button className="text-xs text-primary-400 hover:text-primary-300 flex items-center gap-1 transition-colors">
                            View All <ArrowUpRight className="w-3 h-3" />
                        </button>
                    </div>
                    <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-700">
                        {data.recent_threats.length === 0 ? (
                            <div className="text-sm text-slate-500 text-center py-4">No recent threats detected</div>
                        ) : (
                            data.recent_threats.map((t: any) => (
                                <div key={t.id} className="flex items-start gap-3 p-3 rounded-[2px] bg-slate-900/30 border border-slate-700/30 hover:bg-slate-900/50 transition-colors">
                                    <div className={`mt-1 w-2 h-2 rounded-full ${t.severity >= 4 ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]' : 'bg-yellow-500'}`} />
                                    <div>
                                        <div className="text-sm font-medium text-white">{t.threatType}</div>
                                        <div className="text-xs text-slate-500 font-mono mt-0.5">{t.srcIp} → {t.dstIp}</div>
                                    </div>
                                    <div className="ml-auto text-xs text-slate-600">
                                        {new Date(t.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
