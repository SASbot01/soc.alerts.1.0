import React from 'react';
import type { LucideIcon } from 'lucide-react';
import clsx from 'clsx';

interface MetricCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  target?: number;
  current?: number;
  color?: string;
  subtitle?: string;
}

const MetricCard: React.FC<MetricCardProps> = ({ icon: Icon, label, value, target, current, color = 'primary', subtitle }) => {
  const colorMap: Record<string, string> = {
    primary: 'text-primary-400 bg-primary-500/10 border-primary-500/20',
    green: 'text-green-400 bg-green-500/10 border-green-500/20',
    red: 'text-red-400 bg-red-500/10 border-red-500/20',
    yellow: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
    cyan: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
  };

  const progress = target && current != null ? Math.min(100, (current / target) * 100) : null;

  return (
    <div className="bg-slate-800/50 border border-slate-700/50 rounded-[2px] p-5 backdrop-blur-sm">
      <div className="flex items-start justify-between mb-3">
        <div className={clsx('w-10 h-10 rounded-[2px] flex items-center justify-center border', colorMap[color])}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <div className="text-2xl font-bold text-white mb-1">{value}</div>
      <div className="text-sm text-slate-400">{label}</div>
      {subtitle && <div className="text-xs text-slate-500 mt-1">{subtitle}</div>}

      {progress != null && (
        <div className="mt-3">
          <div className="flex justify-between text-xs text-slate-500 mb-1">
            <span>Progress</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary-500 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default MetricCard;
