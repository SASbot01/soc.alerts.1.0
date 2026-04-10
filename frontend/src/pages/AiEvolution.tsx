import React, { useEffect, useState } from 'react';
import { Sparkles, Brain, Shield, Target, TrendingUp, Download, ChevronDown, ChevronRight, Loader2, Trash2, AlertTriangle } from 'lucide-react';
import clsx from 'clsx';
import api from '../lib/api';
import { aiEvolutionService } from '../lib/services';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface DashboardStats {
  totalStudies: number;
  accuracyScore: number;
  patternsDiscovered: number;
  defenseImprovements: number;
  meanConfidence: number;
  lastSnapshotDate: string | null;
  evolutionEnabled: boolean;
}

interface TimelineData {
  dates: string[];
  accuracy: number[];
  confidence: number[];
  patterns: number[];
  studies: number[];
}

interface Study {
  id: string;
  incidentId: string;
  studyType: string;
  status: string;
  rootCause: string | null;
  attackVectorAnalysis: string | null;
  vulnerabilityExploited: string | null;
  attackSophistication: number | null;
  defenseRecommendations: string | null;
  mitreTechniquesIdentified: string | null;
  newPatternsDiscovered: string | null;
  improvementInsights: string | null;
  lessonsLearned: string | null;
  tokensUsed: number;
  studyDurationMs: number;
  createdAt: string;
  completedAt: string | null;
}

const RANGE_OPTIONS = [
  { label: '7d', days: 7 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
];

const AiEvolution: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [timeline, setTimeline] = useState<TimelineData | null>(null);
  const [studies, setStudies] = useState<Study[]>([]);
  const [selectedRange, setSelectedRange] = useState(30);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [purging, setPurging] = useState(false);
  const [purgeResult, setPurgeResult] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [s, t, st] = await Promise.all([
          aiEvolutionService.getDashboard(),
          aiEvolutionService.getTimeline(selectedRange),
          aiEvolutionService.getStudies(),
        ]);
        setStats(s);
        setTimeline(t);
        setStudies(st);
      } catch (err) {
        console.error('Failed to fetch AI evolution data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    const fetchTimeline = async () => {
      try {
        const t = await aiEvolutionService.getTimeline(selectedRange);
        setTimeline(t);
      } catch (err) {
        console.error('Failed to fetch timeline:', err);
      }
    };
    if (!loading) fetchTimeline();
  }, [selectedRange]);

  const handleExportPDF = async () => {
    setExporting(true);
    try {
      await aiEvolutionService.downloadEvolutionPDF(selectedRange);
    } catch (err) {
      console.error('Failed to export PDF:', err);
    } finally {
      setExporting(false);
    }
  };

  const handlePurgeCorrupted = async () => {
    if (!confirm('Esto marcara como FAILED todos los estudios con respuestas degeneradas/corruptas. Los nuevos estudios empezaran limpios. Continuar?')) return;
    setPurging(true);
    setPurgeResult(null);
    try {
      const res = await api.post('/ai-agent/evolution/studies/purge-corrupted');
      setPurgeResult(res.data.message);
      // Reload data
      const [s, t, st] = await Promise.all([
        aiEvolutionService.getDashboard(),
        aiEvolutionService.getTimeline(selectedRange),
        aiEvolutionService.getStudies(),
      ]);
      setStats(s);
      setTimeline(t);
      setStudies(st);
    } catch (err) {
      setPurgeResult('Error al purgar estudios');
    } finally {
      setPurging(false);
    }
  };

  const parseJson = (str: string | null): string[] => {
    if (!str) return [];
    try { return JSON.parse(str); } catch { return []; }
  };

  // Build chart data
  const chartData = timeline
    ? timeline.dates.map((date, i) => ({
        date: date.substring(5), // MM-DD
        accuracy: timeline.accuracy[i],
        confidence: timeline.confidence[i],
        patterns: timeline.patterns[i],
      }))
    : [];

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-white">AI Agent Evolution</h1>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-slate-800/50 border border-slate-700/50 rounded-[2px] p-4 animate-pulse">
              <div className="h-8 bg-slate-700 rounded w-1/2 mb-2" />
              <div className="h-4 bg-slate-700 rounded w-2/3" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <Sparkles className="w-7 h-7 text-amber-400" />
          AI Agent Evolution
        </h1>
        <div className="flex items-center gap-3">
          <div className="flex bg-slate-800 rounded-[2px] p-1">
            {RANGE_OPTIONS.map(opt => (
              <button
                key={opt.days}
                onClick={() => setSelectedRange(opt.days)}
                className={clsx(
                  "px-3 py-1.5 text-sm font-medium rounded-[2px] transition-colors",
                  selectedRange === opt.days
                    ? "bg-amber-600 text-white"
                    : "text-slate-400 hover:text-white"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <button
            onClick={handlePurgeCorrupted}
            disabled={purging}
            className="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-sm font-medium rounded-[2px] border border-red-500/30 transition-colors disabled:opacity-50"
            title="Purgar estudios corruptos generados por feedback loops de la IA"
          >
            {purging ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            Purgar Corruptos
          </button>
          <button
            onClick={handleExportPDF}
            disabled={exporting}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium rounded-[2px] border border-slate-700 transition-colors disabled:opacity-50"
          >
            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Export PDF
          </button>
        </div>
      </div>

      {/* Purge result banner */}
      {purgeResult && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-[2px] p-3 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
          <span className="text-sm text-amber-300">{purgeResult}</span>
          <button onClick={() => setPurgeResult(null)} className="ml-auto text-slate-500 hover:text-white text-xs">Cerrar</button>
        </div>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          label="Studies Completed"
          value={stats?.totalStudies ?? 0}
          icon={Brain}
          color="purple"
        />
        <MetricCard
          label="Accuracy Score"
          value={stats?.accuracyScore != null ? `${stats.accuracyScore.toFixed(1)}%` : '0%'}
          icon={Target}
          color="amber"
        />
        <MetricCard
          label="Patterns Discovered"
          value={stats?.patternsDiscovered ?? 0}
          icon={TrendingUp}
          color="cyan"
        />
        <MetricCard
          label="Defense Improvements"
          value={stats?.defenseImprovements ?? 0}
          icon={Shield}
          color="green"
        />
      </div>

      {/* Learning Curve Chart */}
      {chartData.length > 0 && (
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-[2px] p-6">
          <h2 className="text-lg font-bold text-white mb-4">Learning Curve</h2>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="gradAccuracy" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradConfidence" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} />
              <YAxis stroke="#94a3b8" fontSize={12} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '2px' }}
                labelStyle={{ color: '#f1f5f9' }}
              />
              <Legend />
              <Area type="monotone" dataKey="accuracy" stroke="#f59e0b" fill="url(#gradAccuracy)" name="Accuracy %" />
              <Area type="monotone" dataKey="confidence" stroke="#06b6d4" fill="url(#gradConfidence)" name="Confidence %" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Two Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Studies */}
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-[2px] p-4">
          <h2 className="text-lg font-bold text-white mb-4">Recent Studies</h2>
          <div className="space-y-2 max-h-[500px] overflow-y-auto">
            {studies.length === 0 ? (
              <p className="text-slate-500 text-sm p-4 text-center">No studies yet. The AI agent will automatically study incidents every 30 minutes.</p>
            ) : (
              studies.slice(0, 20).map(study => (
                <div key={study.id} className="border border-slate-700/50 rounded-[2px]">
                  <button
                    className="w-full flex items-center justify-between p-3 hover:bg-slate-700/30 transition-colors text-left"
                    onClick={() => setExpandedId(expandedId === study.id ? null : study.id)}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {expandedId === study.id ? <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" /> : <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />}
                      <div className="min-w-0">
                        <span className="text-sm font-mono text-slate-300 block truncate">
                          {study.incidentId?.substring(0, 8)}
                        </span>
                        <span className="text-xs text-slate-500">
                          {new Date(study.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={clsx(
                        "px-2 py-0.5 rounded text-xs font-bold",
                        study.status === 'COMPLETED' ? 'bg-green-900/50 text-green-400' :
                        study.status === 'FAILED' ? 'bg-red-900/50 text-red-400' :
                        'bg-yellow-900/50 text-yellow-400'
                      )}>
                        {study.status}
                      </span>
                      {study.attackSophistication != null && (
                        <SophisticationBar value={study.attackSophistication} />
                      )}
                    </div>
                  </button>
                  {expandedId === study.id && (
                    <div className="p-3 pt-0 space-y-3 text-sm border-t border-slate-700/50">
                      {study.rootCause && (
                        <div>
                          <span className="text-slate-400 font-medium">Root Cause:</span>
                          <p className="text-slate-200 mt-1">{study.rootCause}</p>
                        </div>
                      )}
                      {study.attackVectorAnalysis && (
                        <div>
                          <span className="text-slate-400 font-medium">Attack Vector:</span>
                          <p className="text-slate-200 mt-1">{study.attackVectorAnalysis}</p>
                        </div>
                      )}
                      {study.lessonsLearned && (
                        <div>
                          <span className="text-slate-400 font-medium">Lessons Learned:</span>
                          <p className="text-slate-200 mt-1">{study.lessonsLearned}</p>
                        </div>
                      )}
                      {parseJson(study.mitreTechniquesIdentified).length > 0 && (
                        <div>
                          <span className="text-slate-400 font-medium">MITRE Techniques:</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {parseJson(study.mitreTechniquesIdentified).map((t, i) => (
                              <span key={i} className="px-2 py-0.5 bg-purple-900/50 text-purple-300 text-xs rounded font-mono">{t}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      {parseJson(study.defenseRecommendations).length > 0 && (
                        <div>
                          <span className="text-slate-400 font-medium">Defenses:</span>
                          <ul className="mt-1 space-y-1">
                            {parseJson(study.defenseRecommendations).map((d, i) => (
                              <li key={i} className="text-slate-200 text-xs flex items-start gap-1">
                                <Shield className="w-3 h-3 text-green-400 mt-0.5 flex-shrink-0" />
                                {d}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      <div className="flex gap-4 text-xs text-slate-500 pt-1">
                        <span>Tokens: {study.tokensUsed?.toLocaleString()}</span>
                        <span>Duration: {study.studyDurationMs ? `${(study.studyDurationMs / 1000).toFixed(1)}s` : '-'}</span>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Top Defenses */}
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-[2px] p-4">
          <h2 className="text-lg font-bold text-white mb-4">Top Defense Recommendations</h2>
          <div className="space-y-2 max-h-[500px] overflow-y-auto">
            {(() => {
              const allDefenses: string[] = [];
              studies.forEach(s => {
                parseJson(s.defenseRecommendations).forEach(d => allDefenses.push(d));
              });

              const countMap: Record<string, number> = {};
              allDefenses.forEach(d => { countMap[d] = (countMap[d] || 0) + 1; });

              const sorted = Object.entries(countMap)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 15);

              if (sorted.length === 0) {
                return <p className="text-slate-500 text-sm p-4 text-center">No defense recommendations yet.</p>;
              }

              return sorted.map(([defense, count], i) => (
                <div key={i} className="flex items-start gap-3 p-3 bg-slate-900/30 rounded-[2px] border border-slate-700/30">
                  <div className="flex-shrink-0 w-7 h-7 rounded-full bg-green-900/50 text-green-400 flex items-center justify-center text-xs font-bold">
                    {count}
                  </div>
                  <p className="text-sm text-slate-200 leading-relaxed">{defense}</p>
                </div>
              ));
            })()}
          </div>
        </div>
      </div>
    </div>
  );
};

const SophisticationBar: React.FC<{ value: number }> = ({ value }) => {
  const color = value <= 3 ? 'bg-green-500' : value <= 6 ? 'bg-yellow-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-16 h-2 bg-slate-700 rounded-full overflow-hidden">
        <div className={clsx("h-full rounded-full", color)} style={{ width: `${value * 10}%` }} />
      </div>
      <span className="text-xs text-slate-400 font-mono w-6">{value}/10</span>
    </div>
  );
};

const MetricCard: React.FC<{
  label: string;
  value: number | string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}> = ({ label, value, icon: Icon, color }) => {
  const colorMap: Record<string, string> = {
    purple: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
    amber: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    cyan: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
    green: 'text-green-400 bg-green-500/10 border-green-500/20',
  };

  return (
    <div className={clsx("border rounded-[2px] p-4", colorMap[color] || colorMap.purple)}>
      <Icon className="w-5 h-5 mb-2" />
      <div className="text-2xl font-bold text-white">{value}</div>
      <div className="text-xs text-slate-400 mt-1">{label}</div>
    </div>
  );
};

export default AiEvolution;
