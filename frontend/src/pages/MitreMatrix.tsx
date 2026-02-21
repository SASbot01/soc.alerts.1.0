import React, { useEffect, useState, useMemo } from 'react';
import { Grid3X3 } from 'lucide-react';
import { mitreService } from '../lib/services';
import type { MitreCoverageItem } from '../types';
import clsx from 'clsx';

interface MitreTechnique {
  id: string;
  name: string;
  tactic: string;
  description: string;
}

const TACTICS = [
  'Reconnaissance',
  'Initial Access',
  'Execution',
  'Persistence',
  'Privilege Escalation',
  'Defense Evasion',
  'Credential Access',
  'Discovery',
  'Lateral Movement',
  'Collection',
  'Command and Control',
  'Exfiltration',
  'Impact',
];

function getHitColor(hitCount: number): string {
  if (hitCount === 0) return 'bg-slate-800/50 border-slate-700/50 text-slate-500';
  if (hitCount <= 5) return 'bg-green-500/10 border-green-500/30 text-green-400';
  if (hitCount <= 20) return 'bg-green-500/20 border-green-500/40 text-green-300';
  return 'bg-green-500/30 border-green-500/50 text-green-200';
}

const MitreMatrix: React.FC = () => {
  const [techniques, setTechniques] = useState<MitreTechnique[]>([]);
  const [coverage, setCoverage] = useState<MitreCoverageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [hoveredTechnique, setHoveredTechnique] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      mitreService.listTechniques(),
      mitreService.getCoverage(),
    ]).then(([techs, cov]) => {
      setTechniques(techs);
      setCoverage(cov);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  const coverageMap = useMemo(() => {
    const map = new Map<string, MitreCoverageItem>();
    coverage.forEach(c => map.set(c.techniqueId, c));
    return map;
  }, [coverage]);

  const techniquesByTactic = useMemo(() => {
    const map = new Map<string, MitreTechnique[]>();
    TACTICS.forEach(t => map.set(t, []));
    techniques.forEach(tech => {
      // A technique may belong to multiple tactics (comma-separated)
      const tacticList = tech.tactic ? tech.tactic.split(',').map((t: string) => t.trim()) : [];
      tacticList.forEach((tactic: string) => {
        const existing = map.get(tactic);
        if (existing) {
          existing.push(tech);
        }
      });
    });
    return map;
  }, [techniques]);

  const totalTechniques = techniques.length;
  const coveredTechniques = coverage.length;
  const coveragePercent = totalTechniques > 0 ? Math.round((coveredTechniques / totalTechniques) * 100) : 0;
  const totalHits = coverage.reduce((sum, c) => sum + c.hitCount, 0);

  if (loading) return <div className="p-8 text-slate-400">Loading MITRE ATT&CK Matrix...</div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Grid3X3 className="w-8 h-8 text-white" />
          <div>
            <h1 className="text-2xl font-bold text-white">MITRE ATT&CK Matrix</h1>
            <p className="text-sm text-slate-400">Detection coverage across ATT&CK techniques</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-[2px] p-4">
          <div className="text-2xl font-bold text-white">{totalTechniques}</div>
          <div className="text-xs text-slate-400">Total Techniques</div>
        </div>
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-[2px] p-4">
          <div className="text-2xl font-bold text-green-400">{coveredTechniques}</div>
          <div className="text-xs text-slate-400">Covered</div>
        </div>
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-[2px] p-4">
          <div className="text-2xl font-bold text-cyan-400">{coveragePercent}%</div>
          <div className="text-xs text-slate-400">Coverage</div>
        </div>
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-[2px] p-4">
          <div className="text-2xl font-bold text-yellow-400">{totalHits}</div>
          <div className="text-xs text-slate-400">Total Detections</div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-slate-400">
        <span>Legend:</span>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-slate-800/50 border border-slate-700/50 rounded-sm" /> No hits</div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-green-500/10 border border-green-500/30 rounded-sm" /> 1-5 hits</div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-green-500/20 border border-green-500/40 rounded-sm" /> 6-20 hits</div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-green-500/30 border border-green-500/50 rounded-sm" /> 20+ hits</div>
      </div>

      {/* Matrix */}
      <div className="overflow-x-auto">
        <div className="flex gap-1 min-w-max">
          {TACTICS.map(tactic => {
            const tacticTechniques = techniquesByTactic.get(tactic) || [];
            return (
              <div key={tactic} className="flex flex-col min-w-[130px] max-w-[150px]">
                {/* Tactic Header */}
                <div className="bg-slate-800 border border-slate-700 rounded-t-[2px] p-2 text-center">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-300">{tactic}</span>
                </div>
                {/* Techniques */}
                <div className="flex flex-col gap-0.5 mt-0.5">
                  {tacticTechniques.map(tech => {
                    const cov = coverageMap.get(tech.id);
                    const hitCount = cov ? cov.hitCount : 0;
                    const isHovered = hoveredTechnique === tech.id;

                    return (
                      <div
                        key={`${tactic}-${tech.id}`}
                        className={clsx(
                          'relative border rounded-[2px] p-1.5 cursor-default transition-all',
                          getHitColor(hitCount),
                          isHovered && 'ring-1 ring-white/50 z-10'
                        )}
                        onMouseEnter={() => setHoveredTechnique(tech.id)}
                        onMouseLeave={() => setHoveredTechnique(null)}
                      >
                        <div className="text-[9px] font-mono opacity-70">{tech.id}</div>
                        <div className="text-[10px] leading-tight truncate">{tech.name}</div>
                        {hitCount > 0 && (
                          <div className="text-[9px] font-bold mt-0.5">{hitCount} hit{hitCount !== 1 ? 's' : ''}</div>
                        )}

                        {/* Tooltip */}
                        {isHovered && (
                          <div className="absolute left-full ml-2 top-0 z-50 bg-slate-900 border border-slate-600 rounded-[2px] p-3 w-56 shadow-xl pointer-events-none">
                            <div className="text-xs font-bold text-white mb-1">{tech.id} — {tech.name}</div>
                            <div className="text-[10px] text-slate-400 mb-1">{tactic}</div>
                            {cov ? (
                              <>
                                <div className="text-xs text-green-400">{cov.hitCount} detection{cov.hitCount !== 1 ? 's' : ''}</div>
                                {cov.lastSeen && (
                                  <div className="text-[10px] text-slate-500 mt-0.5">Last: {new Date(cov.lastSeen).toLocaleString()}</div>
                                )}
                              </>
                            ) : (
                              <div className="text-xs text-slate-500">No detections</div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {tacticTechniques.length === 0 && (
                    <div className="text-[10px] text-slate-600 p-2 text-center">No techniques</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default MitreMatrix;
