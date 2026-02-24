import React, { useEffect, useState } from 'react';
import { Brain, Shield, Eye, AlertTriangle, Zap, Coins, ChevronDown, ChevronRight } from 'lucide-react';
import clsx from 'clsx';
import { aiAgentService } from '../lib/services';

interface AiDecision {
  id: string;
  companyId: string;
  threatEventId: string;
  verdict: string;
  confidence: number;
  reasoning: string;
  actionsTaken: string;
  incidentCreatedId: string | null;
  ipBlocked: boolean;
  threatStatusUpdated: string;
  batchId: string;
  tokensUsed: number;
  analysisMode: string;
  createdAt: string;
}

interface TokenStats {
  totalTokens: number;
  tokens24h: number;
  tokens7d: number;
  tokens30d: number;
  avgTokensPerDecision: number;
  verdictBreakdown: { verdict: string; tokens: number; count: number }[];
  estimatedCostUsd: number;
}

interface Stats {
  totalDecisions: number;
  activeNoisePatterns: number;
  bufferSize: number;
  autonomousEnabled: boolean;
  verdictBreakdown24h: Record<string, number>;
  verdictBreakdown7d: Record<string, number>;
}

const VERDICT_TABS = ['ALL', 'NOISE', 'LEGITIMATE_SCAN', 'SUSPICIOUS', 'REAL_ATTACK', 'CRITICAL_ATTACK'] as const;

const verdictColor: Record<string, string> = {
  NOISE: 'bg-slate-600 text-slate-200',
  FALSE_POSITIVE: 'bg-slate-600 text-slate-200',
  LEGITIMATE_SCAN: 'bg-cyan-900 text-cyan-300',
  SUSPICIOUS: 'bg-yellow-900 text-yellow-300',
  REAL_ATTACK: 'bg-red-900 text-red-300',
  CRITICAL_ATTACK: 'bg-red-700 text-white',
};

const modeLabel: Record<string, string> = {
  IMMEDIATE: 'Immediate',
  BATCH: 'Batch',
  SUPPRESSED: 'Suppressed',
};

const AiDecisions: React.FC = () => {
  const [stats, setStats] = useState<Stats | null>(null);
  const [tokenStats, setTokenStats] = useState<TokenStats | null>(null);
  const [decisions, setDecisions] = useState<AiDecision[]>([]);
  const [activeTab, setActiveTab] = useState<string>('ALL');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [s, t, d] = await Promise.all([
          aiAgentService.getStats(),
          aiAgentService.getTokenStats(),
          aiAgentService.getDecisions(),
        ]);
        setStats(s);
        setTokenStats(t);
        setDecisions(d);
      } catch (err) {
        console.error('Failed to fetch AI agent data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    const fetchDecisions = async () => {
      try {
        const d = await aiAgentService.getDecisions(activeTab === 'ALL' ? undefined : activeTab);
        setDecisions(d);
      } catch (err) {
        console.error('Failed to fetch decisions:', err);
      }
    };
    if (!loading) fetchDecisions();
  }, [activeTab]);

  const getVerdictCount = (verdict: string): number => {
    if (!stats?.verdictBreakdown7d) return 0;
    return stats.verdictBreakdown7d[verdict] || 0;
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-white">AI Agent Decisions</h1>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-slate-800/50 border border-slate-700/50 rounded-[2px] p-4 animate-pulse">
              <div className="h-8 bg-slate-700 rounded w-1/2 mb-2" />
              <div className="h-4 bg-slate-700 rounded w-2/3" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const totalDecisions7d = Object.values(stats?.verdictBreakdown7d || {}).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <Brain className="w-7 h-7 text-purple-400" />
          AI Agent Decisions
        </h1>
        <span className={clsx(
          "px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider",
          stats?.autonomousEnabled ? "bg-green-900/50 text-green-400 border border-green-700" : "bg-red-900/50 text-red-400 border border-red-700"
        )}>
          {stats?.autonomousEnabled ? 'Active' : 'Disabled'}
        </span>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard label="Total (7d)" value={totalDecisions7d} icon={Brain} color="purple" />
        <StatCard label="Noise" value={getVerdictCount('NOISE') + getVerdictCount('FALSE_POSITIVE')} icon={Shield} color="slate" />
        <StatCard label="Legit Scan" value={getVerdictCount('LEGITIMATE_SCAN')} icon={Eye} color="cyan" />
        <StatCard label="Suspicious" value={getVerdictCount('SUSPICIOUS')} icon={AlertTriangle} color="yellow" />
        <StatCard label="Attacks" value={getVerdictCount('REAL_ATTACK') + getVerdictCount('CRITICAL_ATTACK')} icon={Zap} color="red" />
        <StatCard label="Tokens (7d)" value={tokenStats?.tokens7d?.toLocaleString() || '0'} icon={Coins} color="green" />
      </div>

      {/* Cost Card */}
      {tokenStats && (
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-[2px] p-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
            <div>
              <span className="text-slate-400">Total Tokens</span>
              <p className="text-white font-bold text-lg">{tokenStats.totalTokens.toLocaleString()}</p>
            </div>
            <div>
              <span className="text-slate-400">Last 24h</span>
              <p className="text-white font-bold text-lg">{tokenStats.tokens24h.toLocaleString()}</p>
            </div>
            <div>
              <span className="text-slate-400">Last 30d</span>
              <p className="text-white font-bold text-lg">{tokenStats.tokens30d.toLocaleString()}</p>
            </div>
            <div>
              <span className="text-slate-400">Avg/Decision</span>
              <p className="text-white font-bold text-lg">{Math.round(tokenStats.avgTokensPerDecision)}</p>
            </div>
            <div>
              <span className="text-slate-400">Est. Cost</span>
              <p className="text-green-400 font-bold text-lg">${tokenStats.estimatedCostUsd.toFixed(2)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Verdict Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {VERDICT_TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={clsx(
              "px-4 py-2 rounded-[2px] text-sm font-medium whitespace-nowrap transition-colors",
              activeTab === tab
                ? "bg-purple-600 text-white"
                : "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white"
            )}
          >
            {tab === 'ALL' ? 'All' : tab.replace('_', ' ')}
          </button>
        ))}
      </div>

      {/* Decisions Table */}
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-[2px] overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700 text-slate-400 text-left">
              <th className="p-3 w-8"></th>
              <th className="p-3">Date</th>
              <th className="p-3">Threat ID</th>
              <th className="p-3">Verdict</th>
              <th className="p-3">Confidence</th>
              <th className="p-3">Mode</th>
              <th className="p-3">Tokens</th>
              <th className="p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {decisions.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-8 text-center text-slate-500">No decisions found</td>
              </tr>
            ) : (
              decisions.map(d => (
                <React.Fragment key={d.id}>
                  <tr
                    className="border-b border-slate-700/50 hover:bg-slate-800/80 cursor-pointer transition-colors"
                    onClick={() => setExpandedId(expandedId === d.id ? null : d.id)}
                  >
                    <td className="p-3 text-slate-500">
                      {expandedId === d.id ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </td>
                    <td className="p-3 text-slate-300">
                      {new Date(d.createdAt).toLocaleString()}
                    </td>
                    <td className="p-3 font-mono text-slate-300">
                      {d.threatEventId?.substring(0, 8) || '-'}
                    </td>
                    <td className="p-3">
                      <span className={clsx("px-2 py-1 rounded text-xs font-bold", verdictColor[d.verdict] || 'bg-slate-700 text-slate-300')}>
                        {d.verdict}
                      </span>
                    </td>
                    <td className="p-3 text-slate-300">
                      {d.confidence != null ? `${Math.round(Number(d.confidence) * 100)}%` : '-'}
                    </td>
                    <td className="p-3 text-slate-400">
                      {modeLabel[d.analysisMode] || d.analysisMode}
                    </td>
                    <td className="p-3 text-slate-300">
                      {d.tokensUsed?.toLocaleString() || '0'}
                    </td>
                    <td className="p-3 text-slate-400 text-xs max-w-[200px] truncate">
                      {formatActions(d)}
                    </td>
                  </tr>
                  {expandedId === d.id && (
                    <tr className="bg-slate-900/50">
                      <td colSpan={8} className="p-4">
                        <div className="space-y-2 text-sm">
                          <div>
                            <span className="text-slate-400 font-medium">Reasoning:</span>
                            <p className="text-slate-200 mt-1 whitespace-pre-wrap">{d.reasoning}</p>
                          </div>
                          {d.incidentCreatedId && (
                            <div>
                              <span className="text-slate-400 font-medium">Incident:</span>
                              <span className="text-purple-400 ml-2 font-mono">{d.incidentCreatedId.substring(0, 8)}</span>
                            </div>
                          )}
                          {d.ipBlocked && (
                            <div>
                              <span className="text-red-400 font-medium">IP Blocked</span>
                            </div>
                          )}
                          <div>
                            <span className="text-slate-400 font-medium">Batch:</span>
                            <span className="text-slate-300 ml-2 font-mono">{d.batchId?.substring(0, 8) || '-'}</span>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

function formatActions(d: AiDecision): string {
  const actions: string[] = [];
  if (d.ipBlocked) actions.push('IP blocked');
  if (d.incidentCreatedId) actions.push('Incident');
  if (d.threatStatusUpdated) actions.push(d.threatStatusUpdated);
  return actions.length > 0 ? actions.join(', ') : '-';
}

const StatCard: React.FC<{
  label: string;
  value: number | string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}> = ({ label, value, icon: Icon, color }) => {
  const colorMap: Record<string, string> = {
    purple: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
    slate: 'text-slate-400 bg-slate-500/10 border-slate-500/20',
    cyan: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
    yellow: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
    red: 'text-red-400 bg-red-500/10 border-red-500/20',
    green: 'text-green-400 bg-green-500/10 border-green-500/20',
  };

  return (
    <div className={clsx("border rounded-[2px] p-4", colorMap[color] || colorMap.slate)}>
      <Icon className="w-5 h-5 mb-2" />
      <div className="text-2xl font-bold text-white">{value}</div>
      <div className="text-xs text-slate-400 mt-1">{label}</div>
    </div>
  );
};

export default AiDecisions;
