import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { superAdminService } from '../lib/services';
import { Building2, ShieldAlert, Radio, Globe, Activity, ArrowRight } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface CompanySummary {
    id: string;
    companyName: string;
    domain: string;
    plan: string;
    status: string;
    threatCount: number;
    sensorCount: number;
}

interface GlobalDashboard {
    totalCompanies: number;
    totalThreats: number;
    threatsToday: number;
    totalSensors: number;
    activeSensors: number;
    totalBlockedIPs: number;
    companies: CompanySummary[];
    globalAttackDistribution: Record<string, number>;
}

const SuperAdminDashboard: React.FC = () => {
    const [data, setData] = useState<GlobalDashboard | null>(null);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await superAdminService.getDashboard();
                setData(res);
            } catch (error) {
                console.error('Failed to load global dashboard', error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
        const interval = setInterval(fetchData, 30000);
        return () => clearInterval(interval);
    }, []);

    if (loading) return <div className="p-8 text-slate-400">Loading global dashboard...</div>;
    if (!data) return <div className="p-8 text-red-400">Failed to load data.</div>;

    const stats = [
        { label: 'Companies', value: data.totalCompanies, icon: Building2, color: 'text-indigo-400', bg: 'bg-indigo-400/10' },
        { label: 'Total Threats', value: data.totalThreats, icon: ShieldAlert, color: 'text-red-400', bg: 'bg-red-400/10' },
        { label: 'Threats Today', value: data.threatsToday, icon: Activity, color: 'text-yellow-400', bg: 'bg-yellow-400/10' },
        { label: 'Active Sensors', value: `${data.activeSensors}/${data.totalSensors}`, icon: Radio, color: 'text-green-400', bg: 'bg-green-400/10' },
        { label: 'Blocked IPs', value: data.totalBlockedIPs, icon: Globe, color: 'text-blue-400', bg: 'bg-blue-400/10' },
    ];

    const chartData = Object.entries(data.globalAttackDistribution || {}).map(([name, value]) => ({ name, value }));

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-white mb-1">Global Security Overview</h1>
                <p className="text-slate-400">Cross-company threat monitoring dashboard</p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
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

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Chart */}
                <div className="lg:col-span-2 bg-slate-800/50 border border-slate-700/50 rounded-[2px] p-6 backdrop-blur-sm">
                    <h3 className="text-lg font-semibold text-white mb-6">Global Threat Distribution</h3>
                    <div className="h-[300px] w-full">
                        {chartData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={chartData}>
                                    <defs>
                                        <linearGradient id="colorGlobal" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#999999" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#999999" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#333333" />
                                    <XAxis dataKey="name" stroke="#999999" fontSize={12} tickLine={false} axisLine={false} />
                                    <YAxis stroke="#999999" fontSize={12} tickLine={false} axisLine={false} />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#1A1A1A', borderColor: '#333333', color: '#ffffff' }}
                                        itemStyle={{ color: '#E0E0E0' }}
                                    />
                                    <Area type="monotone" dataKey="value" stroke="#999999" strokeWidth={3} fillOpacity={1} fill="url(#colorGlobal)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center text-slate-500">No threat data available</div>
                        )}
                    </div>
                </div>

                {/* Companies List */}
                <div className="bg-slate-800/50 border border-slate-700/50 rounded-[2px] p-6 backdrop-blur-sm">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-lg font-semibold text-white">Companies</h3>
                        <button
                            onClick={() => navigate('/superadmin/companies')}
                            className="text-xs text-primary-400 hover:text-primary-300 flex items-center gap-1 transition-colors"
                        >
                            View All <ArrowRight className="w-3 h-3" />
                        </button>
                    </div>
                    <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-700">
                        {data.companies.length === 0 ? (
                            <div className="text-sm text-slate-500 text-center py-4">No companies registered</div>
                        ) : (
                            data.companies.map((company) => (
                                <button
                                    key={company.id}
                                    onClick={() => navigate(`/superadmin/company/${company.id}`)}
                                    className="w-full flex items-center gap-3 p-3 rounded-[2px] bg-slate-900/30 border border-slate-700/30 hover:bg-slate-900/50 transition-colors text-left"
                                >
                                    <div className="w-8 h-8 rounded-[2px] bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                                        <Building2 className="w-4 h-4" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-sm font-medium text-white truncate">{company.companyName}</div>
                                        <div className="text-xs text-slate-500">{company.domain}</div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-xs text-red-400 font-medium">{company.threatCount} threats</div>
                                        <div className="text-xs text-slate-500">{company.sensorCount} sensors</div>
                                    </div>
                                </button>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SuperAdminDashboard;
