import React, { useEffect, useState } from 'react';
import api from '../lib/api';
import { Shield, TrendingUp, TrendingDown } from 'lucide-react';

interface RiskBreakdownItem {
    score: number;
    weight: number;
    [key: string]: unknown;
}

interface RiskScoreData {
    score: number;
    maxScore: number;
    riskLevel: string;
    breakdown: Record<string, RiskBreakdownItem>;
    calculatedAt: string;
}

const RiskScoreGauge: React.FC = () => {
    const [data, setData] = useState<RiskScoreData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.get('/dashboard/risk-score')
            .then(r => setData(r.data))
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    if (loading || !data) {
        return (
            <div className="bg-slate-900/60 border border-slate-800 rounded-[2px] p-6 animate-pulse">
                <div className="h-32 bg-slate-800 rounded" />
            </div>
        );
    }

    const { score, riskLevel, breakdown } = data;

    const colorMap: Record<string, string> = {
        CRITICAL: 'text-red-400',
        HIGH: 'text-orange-400',
        MEDIUM: 'text-yellow-400',
        LOW: 'text-emerald-400',
    };

    const bgColorMap: Record<string, string> = {
        CRITICAL: 'bg-red-500',
        HIGH: 'bg-orange-500',
        MEDIUM: 'bg-yellow-500',
        LOW: 'bg-emerald-500',
    };

    const ringColorMap: Record<string, string> = {
        CRITICAL: 'stroke-red-500',
        HIGH: 'stroke-orange-500',
        MEDIUM: 'stroke-yellow-500',
        LOW: 'stroke-emerald-500',
    };

    const circumference = 2 * Math.PI * 45;
    const progress = (score / 100) * circumference;

    return (
        <div className="bg-slate-900/60 border border-slate-800 rounded-[2px] p-6">
            <div className="flex items-center gap-2 mb-4">
                <Shield className="w-5 h-5 text-slate-400" />
                <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Risk Score</h3>
            </div>

            <div className="flex items-center gap-6">
                {/* Circular gauge */}
                <div className="relative w-28 h-28 flex-shrink-0">
                    <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                        <circle cx="50" cy="50" r="45" fill="none" strokeWidth="8"
                            className="stroke-slate-800" />
                        <circle cx="50" cy="50" r="45" fill="none" strokeWidth="8"
                            className={ringColorMap[riskLevel]}
                            strokeDasharray={circumference}
                            strokeDashoffset={circumference - progress}
                            strokeLinecap="round"
                            style={{ transition: 'stroke-dashoffset 1s ease-in-out' }} />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className={`text-2xl font-bold ${colorMap[riskLevel]}`}>{score}</span>
                        <span className="text-[10px] text-slate-500 uppercase">/100</span>
                    </div>
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                    <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-[2px] text-xs font-bold uppercase tracking-wider ${bgColorMap[riskLevel]}/10 ${colorMap[riskLevel]} border border-current/20 mb-3`}>
                        {score >= 50 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {riskLevel} Risk
                    </div>

                    <div className="space-y-1.5">
                        {Object.entries(breakdown).map(([key, val]) => (
                            <div key={key} className="flex items-center gap-2">
                                <span className="text-[10px] text-slate-500 uppercase w-28 shrink-0">{key}</span>
                                <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full rounded-full ${val.score >= 75 ? 'bg-red-500' : val.score >= 50 ? 'bg-orange-500' : val.score >= 25 ? 'bg-yellow-500' : 'bg-emerald-500'}`}
                                        style={{ width: `${val.score}%`, transition: 'width 1s ease-in-out' }}
                                    />
                                </div>
                                <span className="text-[10px] text-slate-500 w-6 text-right">{val.score}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RiskScoreGauge;
