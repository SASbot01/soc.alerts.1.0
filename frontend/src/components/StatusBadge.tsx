import React from 'react';
import clsx from 'clsx';

const statusColors: Record<string, string> = {
  // Audit statuses
  SCOPING: 'bg-blue-500/20 text-blue-400',
  SCANNING: 'bg-cyan-500/20 text-cyan-400',
  TESTING: 'bg-yellow-500/20 text-yellow-400',
  REPORTING: 'bg-orange-500/20 text-orange-400',
  DELIVERED: 'bg-green-500/20 text-green-400',
  // Pentest statuses
  PLANNING: 'bg-blue-500/20 text-blue-400',
  RECONNAISSANCE: 'bg-cyan-500/20 text-cyan-400',
  EXPLOITATION: 'bg-red-500/20 text-red-400',
  POST_EXPLOITATION: 'bg-orange-500/20 text-orange-400',
  // Vulnerability statuses
  DETECTED: 'bg-red-500/20 text-red-400',
  CONFIRMED: 'bg-orange-500/20 text-orange-400',
  IN_REMEDIATION: 'bg-yellow-500/20 text-yellow-400',
  FIXED: 'bg-green-500/20 text-green-400',
  VERIFIED: 'bg-emerald-500/20 text-emerald-400',
  // Certification statuses
  PENDING: 'bg-yellow-500/20 text-yellow-400',
  ACTIVE: 'bg-green-500/20 text-green-400',
  EXPIRED: 'bg-slate-500/20 text-slate-400',
  REVOKED: 'bg-red-500/20 text-red-400',
  // Finding statuses
  OPEN: 'bg-red-500/20 text-red-400',
  RESOLVED: 'bg-green-500/20 text-green-400',
  // Generic
  online: 'bg-green-500/20 text-green-400',
  offline: 'bg-slate-500/20 text-slate-400',
  detected: 'bg-yellow-500/20 text-yellow-400',
  blocked: 'bg-red-500/20 text-red-400',
  resolved: 'bg-green-500/20 text-green-400',
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className }) => {
  const colorClass = statusColors[status] || 'bg-slate-500/20 text-slate-400';
  return (
    <span className={clsx('px-2.5 py-1 rounded-[2px] text-xs font-semibold uppercase tracking-wider', colorClass, className)}>
      {status.replace(/_/g, ' ')}
    </span>
  );
};

export default StatusBadge;
