import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { superAdminService } from '../lib/services';
import { Building2, ExternalLink } from 'lucide-react';

interface CompanySummary {
    id: string;
    companyName: string;
    domain: string;
    plan: string;
    status: string;
    threatCount: number;
    sensorCount: number;
}

const Companies: React.FC = () => {
    const [companies, setCompanies] = useState<CompanySummary[]>([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        const fetchCompanies = async () => {
            try {
                const data = await superAdminService.getCompanies();
                setCompanies(data);
            } catch (error) {
                console.error('Failed to load companies', error);
            } finally {
                setLoading(false);
            }
        };
        fetchCompanies();
    }, []);

    if (loading) return <div className="p-8 text-slate-400">Loading companies...</div>;

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-white mb-1">Companies</h1>
                <p className="text-slate-400">All registered companies in the platform</p>
            </div>

            <div className="bg-slate-800/50 border border-slate-700/50 rounded-[2px] overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-slate-700/50">
                                <th className="text-left px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Company</th>
                                <th className="text-left px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Domain</th>
                                <th className="text-left px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Plan</th>
                                <th className="text-left px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Status</th>
                                <th className="text-left px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Threats</th>
                                <th className="text-left px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Sensors</th>
                                <th className="text-right px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700/30">
                            {companies.map((company) => (
                                <tr key={company.id} className="hover:bg-slate-800/30 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-[2px] bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                                                <Building2 className="w-4 h-4" />
                                            </div>
                                            <span className="text-sm font-medium text-white">{company.companyName}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-slate-300 font-mono">{company.domain}</td>
                                    <td className="px-6 py-4">
                                        <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-medium bg-primary-500/10 text-primary-400 border border-primary-500/20">
                                            {company.plan}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${
                                            company.status === 'active'
                                                ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                                                : 'bg-red-500/10 text-red-400 border border-red-500/20'
                                        }`}>
                                            {company.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-red-400 font-medium">{company.threatCount}</td>
                                    <td className="px-6 py-4 text-sm text-slate-300">{company.sensorCount}</td>
                                    <td className="px-6 py-4 text-right">
                                        <button
                                            onClick={() => navigate(`/superadmin/company/${company.id}`)}
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary-400 hover:text-primary-300 bg-primary-500/10 hover:bg-primary-500/20 border border-primary-500/20 rounded-[2px] transition-colors"
                                        >
                                            View Dashboard <ExternalLink className="w-3 h-3" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {companies.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                                        <Building2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
                                        No companies registered
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default Companies;
