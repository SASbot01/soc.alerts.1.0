import React, { useEffect, useState } from 'react';
import { BarChart3, ClipboardCheck, Crosshair, Bug, Award, Clock, TrendingUp } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { certificationService } from '../lib/services';
import type { SocMetricsResponse } from '../types';
import MetricCard from '../components/MetricCard';

const COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4'];

const SocMetrics: React.FC = () => {
    const [metrics, setMetrics] = useState<SocMetricsResponse | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchMetrics = async () => {
            try {
                setMetrics(await certificationService.getMetrics());
            } catch (err) {
                console.error('Failed to fetch metrics:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchMetrics();
    }, []);

    if (loading || !metrics) {
        return (
            <div className="space-y-6">
                <h1 className="text-2xl font-bold text-white">SOC Metrics</h1>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {[...Array(8)].map((_, i) => (
                        <div key={i} className="bg-slate-800/50 border border-slate-700/50 rounded-[2px] p-5 animate-pulse">
                            <div className="h-10 w-10 bg-slate-700 rounded-[2px] mb-3" />
                            <div className="h-6 bg-slate-700 rounded w-1/3 mb-2" />
                            <div className="h-4 bg-slate-700 rounded w-2/3" />
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    const vulnStatusData = [
        { name: 'Open', value: metrics.openVulnerabilities },
        { name: 'Fixed', value: metrics.fixedVulnerabilities },
    ].filter(d => d.value > 0);

    const auditData = [
        { name: 'Audits', completed: metrics.completedAudits, total: metrics.totalAudits },
        { name: 'Pentests', completed: metrics.completedPentests, total: metrics.totalPentests },
    ];

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold text-white">SOC Metrics Dashboard</h1>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <MetricCard icon={ClipboardCheck} label="Total Audits" value={metrics.totalAudits}
                    subtitle={`${metrics.completedAudits} completed`} color="primary" />
                <MetricCard icon={Crosshair} label="Total Pentests" value={metrics.totalPentests}
                    subtitle={`${metrics.completedPentests} completed`} color="cyan" />
                <MetricCard icon={Bug} label="Open Vulnerabilities" value={metrics.openVulnerabilities}
                    subtitle={`${metrics.fixedVulnerabilities} fixed`} color="red" />
                <MetricCard icon={Award} label="Active Certifications" value={metrics.activeCertifications}
                    color="green" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <MetricCard icon={Clock} label="Avg Remediation (days)" value={metrics.avgRemediationDays}
                    color="yellow" />
                <MetricCard icon={TrendingUp} label="Audit Delivery (days)" value={metrics.auditDeliveryDays}
                    color="primary" />
                <MetricCard icon={Bug} label="Fixed Vulnerabilities" value={metrics.fixedVulnerabilities}
                    color="green" target={metrics.openVulnerabilities + metrics.fixedVulnerabilities}
                    current={metrics.fixedVulnerabilities} />
                <MetricCard icon={BarChart3} label="Completion Rate"
                    value={metrics.totalAudits > 0 ? `${Math.round((metrics.completedAudits / metrics.totalAudits) * 100)}%` : 'N/A'}
                    color="cyan" />
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-slate-800/50 border border-slate-700/50 rounded-[2px] p-5">
                    <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Completed vs Total</h3>
                    <ResponsiveContainer width="100%" height={250}>
                        <BarChart data={auditData}>
                            <XAxis dataKey="name" stroke="#999999" fontSize={12} />
                            <YAxis stroke="#999999" fontSize={12} />
                            <Tooltip contentStyle={{ backgroundColor: '#1A1A1A', border: '1px solid #333333', borderRadius: '8px', color: '#fff' }} />
                            <Bar dataKey="total" fill="#333333" radius={[4, 4, 0, 0]} name="Total" />
                            <Bar dataKey="completed" fill="#ffffff" radius={[4, 4, 0, 0]} name="Completed" />
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                <div className="bg-slate-800/50 border border-slate-700/50 rounded-[2px] p-5">
                    <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Vulnerability Status</h3>
                    {vulnStatusData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={250}>
                            <PieChart>
                                <Pie data={vulnStatusData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                                    {vulnStatusData.map((_, idx) => (
                                        <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip contentStyle={{ backgroundColor: '#1A1A1A', border: '1px solid #333333', borderRadius: '8px', color: '#fff' }} />
                            </PieChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="flex items-center justify-center h-[250px] text-slate-500 text-sm">No vulnerability data</div>
                    )}
                </div>
            </div>

            {/* Recent Metrics */}
            {metrics.recentMetrics.length > 0 && (
                <div className="bg-slate-800/50 border border-slate-700/50 rounded-[2px] p-5">
                    <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Custom Metrics</h3>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead>
                                <tr className="border-b border-slate-700/50 text-slate-400">
                                    <th className="pb-3 font-medium">Metric</th>
                                    <th className="pb-3 font-medium">Value</th>
                                    <th className="pb-3 font-medium">Target</th>
                                    <th className="pb-3 font-medium">Period</th>
                                    <th className="pb-3 font-medium">Recorded</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-700/30">
                                {metrics.recentMetrics.map((m, i) => (
                                    <tr key={i} className="text-slate-300">
                                        <td className="py-3 text-white font-medium">{m.name}</td>
                                        <td className="py-3">{m.value} {m.unit}</td>
                                        <td className="py-3">{m.target || '-'}</td>
                                        <td className="py-3">{m.period}</td>
                                        <td className="py-3 text-slate-500">{new Date(m.recordedAt).toLocaleDateString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SocMetrics;
