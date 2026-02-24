import React from 'react';
import { Globe, Shield, Server, AlertTriangle, Eye, Radio } from 'lucide-react';
import clsx from 'clsx';

interface EnrichmentData {
    ip: string;
    abuseConfidenceScore: number;
    countryCode: string;
    isp: string;
    domain: string;
    tor: boolean;
    vpn: boolean;
    totalReports: number;
    virustotalMalicious: number;
    virustotalSuspicious: number;
    virustotalHarmless: number;
    greynoiseClassification: string;
    greynoiseName: string;
    greynoiseNoise: boolean;
    greynoiseRiot: boolean;
    shodanPorts: string;
    shodanOs: string;
    shodanVulns: string;
    shodanOrg: string;
    otxPulseCount: number;
    otxTags: string;
    enrichmentSources: string;
    enrichedAt: string;
}

interface Props {
    enrichment: EnrichmentData | null;
    loading?: boolean;
}

const ThreatEnrichmentPanel: React.FC<Props> = ({ enrichment, loading }) => {
    if (loading) {
        return (
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-[2px] p-4 animate-pulse">
                <div className="h-4 bg-slate-700 rounded w-1/3 mb-3"></div>
                <div className="h-3 bg-slate-700 rounded w-2/3 mb-2"></div>
                <div className="h-3 bg-slate-700 rounded w-1/2"></div>
            </div>
        );
    }

    if (!enrichment) return null;

    const sources = enrichment.enrichmentSources?.split(',').filter(Boolean) || [];
    const abuseScore = enrichment.abuseConfidenceScore || 0;
    const vtMalicious = enrichment.virustotalMalicious || 0;
    const vtTotal = vtMalicious + (enrichment.virustotalSuspicious || 0) + (enrichment.virustotalHarmless || 0);
    const shodanPorts = enrichment.shodanPorts?.split(',').filter(Boolean) || [];
    const shodanVulns = enrichment.shodanVulns?.split(',').filter(Boolean) || [];
    const otxTags = enrichment.otxTags?.split(',').filter(Boolean) || [];

    const riskLevel = abuseScore >= 80 || vtMalicious >= 5 ? 'critical'
        : abuseScore >= 50 || vtMalicious >= 2 ? 'high'
        : abuseScore >= 20 || vtMalicious >= 1 ? 'medium'
        : 'low';

    const riskColors = {
        critical: 'text-red-400 bg-red-500/10 border-red-500/20',
        high: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
        medium: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
        low: 'text-green-400 bg-green-500/10 border-green-500/20',
    };

    return (
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-[2px] p-4 space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <Eye className="w-4 h-4 text-primary-400" />
                    Threat Intelligence: {enrichment.ip}
                </h3>
                <span className={clsx("px-2 py-0.5 text-xs font-medium rounded border", riskColors[riskLevel])}>
                    {riskLevel.toUpperCase()} RISK
                </span>
            </div>

            {/* Base info */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <InfoCard icon={Globe} label="Country" value={enrichment.countryCode || '—'} />
                <InfoCard icon={Server} label="ISP" value={enrichment.isp || '—'} />
                <InfoCard icon={Shield} label="Abuse Score" value={`${abuseScore}%`}
                    valueClass={abuseScore >= 50 ? 'text-red-400' : abuseScore >= 20 ? 'text-amber-400' : 'text-green-400'} />
                <InfoCard icon={AlertTriangle} label="Reports" value={String(enrichment.totalReports || 0)} />
            </div>

            {/* Flags */}
            {(enrichment.tor || enrichment.vpn || enrichment.greynoiseRiot) && (
                <div className="flex gap-2 flex-wrap">
                    {enrichment.tor && <Badge text="TOR Exit Node" color="red" />}
                    {enrichment.vpn && <Badge text="VPN/Proxy" color="amber" />}
                    {enrichment.greynoiseRiot && <Badge text="RIOT (Benign Service)" color="green" />}
                    {enrichment.greynoiseNoise && <Badge text="Internet Noise" color="slate" />}
                </div>
            )}

            {/* Provider details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* VirusTotal */}
                {sources.includes('virustotal') && (
                    <ProviderCard
                        name="VirusTotal"
                        content={
                            <div className="flex items-center gap-3">
                                <span className={clsx("text-lg font-bold", vtMalicious > 0 ? "text-red-400" : "text-green-400")}>
                                    {vtMalicious}/{vtTotal}
                                </span>
                                <span className="text-xs text-slate-500">engines flagged malicious</span>
                            </div>
                        }
                    />
                )}

                {/* GreyNoise */}
                {sources.includes('greynoise') && (
                    <ProviderCard
                        name="GreyNoise"
                        content={
                            <div>
                                <span className={clsx("text-sm font-medium",
                                    enrichment.greynoiseClassification === 'malicious' ? 'text-red-400'
                                    : enrichment.greynoiseClassification === 'benign' ? 'text-green-400'
                                    : 'text-slate-400'
                                )}>
                                    {enrichment.greynoiseClassification || 'unknown'}
                                </span>
                                {enrichment.greynoiseName && (
                                    <span className="text-xs text-slate-500 ml-2">({enrichment.greynoiseName})</span>
                                )}
                            </div>
                        }
                    />
                )}

                {/* Shodan */}
                {sources.includes('shodan') && (
                    <ProviderCard
                        name="Shodan"
                        content={
                            <div className="space-y-1">
                                {shodanPorts.length > 0 && (
                                    <div className="flex flex-wrap gap-1">
                                        {shodanPorts.slice(0, 10).map(p => (
                                            <span key={p} className="px-1.5 py-0.5 bg-slate-700 text-slate-300 text-[10px] rounded">{p}</span>
                                        ))}
                                        {shodanPorts.length > 10 && <span className="text-[10px] text-slate-500">+{shodanPorts.length - 10}</span>}
                                    </div>
                                )}
                                {shodanVulns.length > 0 && (
                                    <div className="flex flex-wrap gap-1">
                                        {shodanVulns.slice(0, 5).map(v => (
                                            <span key={v} className="px-1.5 py-0.5 bg-red-500/10 text-red-400 text-[10px] rounded">{v}</span>
                                        ))}
                                    </div>
                                )}
                                {enrichment.shodanOrg && <span className="text-xs text-slate-500">{enrichment.shodanOrg}</span>}
                            </div>
                        }
                    />
                )}

                {/* OTX */}
                {sources.includes('otx') && (
                    <ProviderCard
                        name="AlienVault OTX"
                        content={
                            <div className="space-y-1">
                                <span className={clsx("text-sm font-medium",
                                    (enrichment.otxPulseCount || 0) > 0 ? 'text-amber-400' : 'text-green-400'
                                )}>
                                    {enrichment.otxPulseCount || 0} pulses
                                </span>
                                {otxTags.length > 0 && (
                                    <div className="flex flex-wrap gap-1">
                                        {otxTags.slice(0, 6).map(t => (
                                            <span key={t} className="px-1.5 py-0.5 bg-slate-700 text-slate-300 text-[10px] rounded">{t}</span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        }
                    />
                )}
            </div>

            {/* Sources footer */}
            <div className="flex items-center gap-2 pt-1 border-t border-slate-700/50">
                <Radio className="w-3 h-3 text-slate-600" />
                <span className="text-[10px] text-slate-600">
                    Sources: {sources.join(', ')} | Updated: {enrichment.enrichedAt ? new Date(enrichment.enrichedAt).toLocaleString() : '—'}
                </span>
            </div>
        </div>
    );
};

const InfoCard: React.FC<{ icon: React.ComponentType<{ className?: string }>; label: string; value: string; valueClass?: string }> = ({ icon: Icon, label, value, valueClass }) => (
    <div className="bg-slate-900/50 rounded-[2px] p-2">
        <div className="flex items-center gap-1 mb-1">
            <Icon className="w-3 h-3 text-slate-500" />
            <span className="text-[10px] text-slate-500 uppercase">{label}</span>
        </div>
        <span className={clsx("text-sm font-medium", valueClass || "text-white")}>{value}</span>
    </div>
);

const ProviderCard: React.FC<{ name: string; content: React.ReactNode }> = ({ name, content }) => (
    <div className="bg-slate-900/50 rounded-[2px] p-3">
        <span className="text-[10px] text-slate-500 uppercase tracking-wider">{name}</span>
        <div className="mt-1">{content}</div>
    </div>
);

const Badge: React.FC<{ text: string; color: string }> = ({ text, color }) => (
    <span className={clsx("px-2 py-0.5 text-[10px] font-medium rounded",
        color === 'red' && "bg-red-500/10 text-red-400",
        color === 'amber' && "bg-amber-500/10 text-amber-400",
        color === 'green' && "bg-green-500/10 text-green-400",
        color === 'slate' && "bg-slate-700 text-slate-400",
    )}>
        {text}
    </span>
);

export default ThreatEnrichmentPanel;
