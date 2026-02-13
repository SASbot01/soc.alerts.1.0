import React from 'react';
import clsx from 'clsx';

const severityConfig: Record<string, { color: string; label: string }> = {
  CRITICAL: { color: 'bg-red-500/20 text-red-400 border-red-500/30', label: 'Critical' },
  HIGH: { color: 'bg-orange-500/20 text-orange-400 border-orange-500/30', label: 'High' },
  MEDIUM: { color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', label: 'Medium' },
  LOW: { color: 'bg-blue-500/20 text-blue-400 border-blue-500/30', label: 'Low' },
  INFO: { color: 'bg-slate-500/20 text-slate-400 border-slate-500/30', label: 'Info' },
};

interface SeverityBadgeProps {
  level: string;
  score?: number;
  className?: string;
}

const SeverityBadge: React.FC<SeverityBadgeProps> = ({ level, score, className }) => {
  const config = severityConfig[level] || severityConfig.INFO;
  return (
    <span className={clsx('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[2px] text-xs font-semibold border', config.color, className)}>
      {config.label}
      {score != null && <span className="opacity-75">({score})</span>}
    </span>
  );
};

export default SeverityBadge;
