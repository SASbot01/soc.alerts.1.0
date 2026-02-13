import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { superAdminService } from '../lib/services';
import { ShieldAlert, Radio, Activity, Globe, ArrowLeft } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const CompanyDetail: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        if (!id) return;
        const fetchData = async () => {
            try {
                const res = await superAdminService.getCompanyDashboard(id);
                setData(res);
            } catch (error) {
                console.error('Failed to load company dashboard', error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [id]);

    if (loading) return <div className="p-8 text-slate-400">Loading company dashboard...</div>;
    if (!data) return <div className="p-8 text-red-400">Failed to load data.</div>;

    const stats = [
        { label: 'Total Threats', value: data.stats.total_threats, icon: ShieldAlert, color: 'text-red-400', bg: 'bg-red-400/10' },
        { label: 'Active Sensors', value: data.stats.active_sensors, icon: Radio, color: 'text-green-400', bg: 'bg-green-400/10' },
        { label: 'Threats Today', value: data.stats.threats_today, icon: Activity, color: 'text-yellow-400', bg: 'bg-yellow-400/10' },
        { label: 'Blocked IPs', value: data.stats.blocked_ips, icon: Globe, color: 'text-blue-400', bg: 'bg-blue-400/10' },
    ];

    const chartData = Object.entries(data.attack_distribution || {}).map(([name, value]) => ({ name, value }));

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <button
                    onClick={() => navigate('/superadmin/companies')}
                    className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-[2px] transition-colors"
                >
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <div>
                    <h1 className="text-2xl font-bold text-white mb-1">{data.company?.name || 'Company Dashboard'}</h1>
                    <p className="text-slate-400">
                        {data.company?.domain && <span className="font-mono text-primary-400">{data.company.domain}</span>}
                        {data.company?.plan && <span className="ml-2 text-slate-500">({data.company.plan})</span>}
                    </p>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {stats.map((stat, idx) => (
                    <div key={idx} className="bg-slate-800/50 border border-slate-700/50 p-4 rounded-[2px] backdrop-blur-sm">
                        <div className="flex justify-between items-start mb-4">
                            <div className={`p-2 rounded-[2px] ${stat.bg} ${stat.color}`}>
                                <stat.icon className="w-6 h-6" />
                            </div>
                        </div>
                        <div className="text-3xl font-bold text-white mb-1">{stat.value}</div>
                        <div className="text-sm text-slate-400">{stat.label}</div>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Chart */}
                <div className="lg:col-span-2 bg-slate-800/50 border border-slate-700/50 rounded-[2px] p-6 backdrop-blur-sm">
                    <h3 className="text-lg font-semibold text-white mb-6">Threat Distribution</h3>
                    <div className="h-[300px] w-full">
                        {chartData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={chartData}>
                                    <defs>
                                        <linearGradient id="colorCompany" x1="0" y1="0" x2="0" y2="1">
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
                                    <Area type="monotone" dataKey="value" stroke="#ffffff" strokeWidth={3} fillOpacity={1} fill="url(#colorCompany)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center text-slate-500">No threat data available</div>
                        )}
                    </div>
                </div>

                {/* Recent Threats */}
                <div className="bg-slate-800/50 border border-slate-700/50 rounded-[2px] p-6 backdrop-blur-sm overflow-hidden">
                    <h3 className="text-lg font-semibold text-white mb-6">Recent Threats</h3>
                    <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-700">
                        {(!data.recent_threats || data.recent_threats.length === 0) ? (
                            <div className="text-sm text-slate-500 text-center py-4">No recent threats detected</div>
                        ) : (
                            data.recent_threats.map((t: any) => (
                                <div key={t.id} className="flex items-start gap-3 p-3 rounded-[2px] bg-slate-900/30 border border-slate-700/30">
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

export default CompanyDetail;
