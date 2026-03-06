import React, { useEffect, useState, useCallback } from 'react';
import {
  Bot, Users, TrendingUp, FileText, MessageSquare, Pause, Play,
  Search, UserPlus, Send, RefreshCw, Cookie, LogIn, Clock,
  XCircle, ArrowRight, Loader2
} from 'lucide-react';
import MetricCard from '../components/MetricCard';
import { prospectorBotService } from '../lib/services';

interface BotStatus {
  linkedin_stats?: {
    connections_sent_today?: number;
    max_connections_day?: number;
    acceptance_rate?: number;
    messages_sent_today?: number;
    max_messages_day?: number;
  };
  last_search?: { ran_at?: string; processed?: number; connections_sent?: number; emails_sent?: number; skipped?: number } | null;
  last_followup?: { ran_at?: string; checked?: number; messages_sent?: number } | null;
  last_publish?: { ran_at?: string; topic?: string; status?: string } | null;
  last_improve?: { ran_at?: string; status?: string } | null;
  publisher_stats?: { total_posts?: number; enabled?: boolean; ai_provider?: string } | null;
  scheduler?: { running?: boolean; jobs?: Array<{ id: string; next_run?: string }> } | null;
}

interface BotHealth {
  status?: string;
  linkedin_logged_in?: boolean;
  paused?: boolean;
  working_hours?: boolean;
}

const BotDashboard: React.FC = () => {
  const [health, setHealth] = useState<BotHealth | null>(null);
  const [status, setStatus] = useState<BotStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionResult, setActionResult] = useState<{ action: string; result: string; ok: boolean } | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [h, s] = await Promise.all([
        prospectorBotService.health(),
        prospectorBotService.status(),
      ]);
      setHealth(h);
      setStatus(s);
      setError(null);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Bot not reachable');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const runAction = async (name: string, fn: () => Promise<any>) => {
    setActionLoading(name);
    setActionResult(null);
    try {
      const res = await fn();
      setActionResult({ action: name, result: JSON.stringify(res, null, 2), ok: true });
      fetchData();
    } catch (err: any) {
      setActionResult({
        action: name,
        result: err?.response?.data?.detail || err?.message || 'Failed',
        ok: false,
      });
    } finally {
      setActionLoading(null);
    }
  };

  const timeAgo = (iso?: string) => {
    if (!iso) return 'never';
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ${mins % 60}m ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  const formatNextRun = (iso?: string) => {
    if (!iso) return '—';
    const diff = new Date(iso).getTime() - Date.now();
    if (diff < 0) return 'overdue';
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `in ${mins} min`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `in ${hours}h ${mins % 60}m`;
    return new Date(iso).toLocaleString();
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-white">Bot Dashboard</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
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

  if (error && !health) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-white">Bot Dashboard</h1>
        <div className="bg-red-500/10 border border-red-500/30 rounded-[2px] p-6 text-center">
          <XCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
          <p className="text-red-400 text-lg font-medium">{error}</p>
          <p className="text-slate-500 text-sm mt-2">The prospector bot service is not responding.</p>
          <button
            onClick={fetchData}
            className="mt-4 px-4 py-2 bg-slate-800 border border-slate-700 text-slate-300 rounded-[2px] hover:bg-slate-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const stats = status?.linkedin_stats;
  const isPaused = health?.paused ?? false;
  const isLoggedIn = health?.linkedin_logged_in ?? false;
  const inHours = health?.working_hours ?? false;
  const postsPublished = status?.publisher_stats?.total_posts ?? 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Bot Dashboard</h1>
        <button
          onClick={fetchData}
          className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 border border-slate-700 text-slate-300 rounded-[2px] hover:bg-slate-700 transition-colors text-sm"
        >
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          icon={Users}
          label="Connections Today"
          value={`${stats?.connections_sent_today ?? 0}/${stats?.max_connections_day ?? 20}`}
          color="primary"
          target={stats?.max_connections_day ?? 20}
          current={stats?.connections_sent_today ?? 0}
        />
        <MetricCard
          icon={TrendingUp}
          label="Acceptance Rate"
          value={`${(stats?.acceptance_rate ?? 0).toFixed(1)}%`}
          color="green"
        />
        <MetricCard
          icon={FileText}
          label="Posts Published"
          value={postsPublished}
          color="cyan"
        />
        <MetricCard
          icon={MessageSquare}
          label="Messages Today"
          value={`${stats?.messages_sent_today ?? 0}/${stats?.max_messages_day ?? 15}`}
          color="yellow"
          target={stats?.max_messages_day ?? 15}
          current={stats?.messages_sent_today ?? 0}
        />
      </div>

      {/* Controls + Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Controls Panel */}
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-[2px] p-5">
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Controls</h3>

          {/* Status Badges */}
          <div className="flex flex-wrap gap-2 mb-5">
            <StatusBadge label="Logged In" active={isLoggedIn} />
            <StatusBadge label={isPaused ? 'Paused' : 'Active'} active={!isPaused} />
            <StatusBadge label="In Hours" active={inHours} />
          </div>

          {/* Pause / Resume */}
          <button
            onClick={() => runAction(isPaused ? 'resume' : 'pause', isPaused ? prospectorBotService.resume : prospectorBotService.pause)}
            disabled={actionLoading !== null}
            className={`w-full py-3 rounded-[2px] font-bold text-sm mb-4 transition-colors flex items-center justify-center gap-2 ${
              isPaused
                ? 'bg-green-500/20 border border-green-500/30 text-green-400 hover:bg-green-500/30'
                : 'bg-yellow-500/20 border border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/30'
            }`}
          >
            {actionLoading === 'pause' || actionLoading === 'resume' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : isPaused ? (
              <Play className="w-4 h-4" />
            ) : (
              <Pause className="w-4 h-4" />
            )}
            {isPaused ? 'RESUME BOT' : 'PAUSE BOT'}
          </button>

          {/* Manual Actions */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <ActionButton
              icon={Search}
              label="Search"
              loading={actionLoading === 'search'}
              disabled={actionLoading !== null}
              onClick={() => runAction('search', prospectorBotService.search)}
            />
            <ActionButton
              icon={UserPlus}
              label="Followup"
              loading={actionLoading === 'followup'}
              disabled={actionLoading !== null}
              onClick={() => runAction('followup', prospectorBotService.followup)}
            />
            <ActionButton
              icon={Send}
              label="Publish"
              loading={actionLoading === 'publish'}
              disabled={actionLoading !== null}
              onClick={() => runAction('publish', prospectorBotService.publish)}
            />
          </div>

          {/* Re-login / Cookies */}
          <div className="grid grid-cols-2 gap-3">
            <ActionButton
              icon={LogIn}
              label="Re-Login"
              loading={actionLoading === 'relogin'}
              disabled={actionLoading !== null}
              onClick={() => runAction('relogin', prospectorBotService.relogin)}
              variant="secondary"
            />
            <CookieUploadButton
              disabled={actionLoading !== null}
              loading={actionLoading === 'cookies'}
              onUpload={(cookies) => runAction('cookies', () => prospectorBotService.uploadCookies(cookies))}
            />
          </div>

          {/* Action Result */}
          {actionResult && (
            <div className={`mt-4 p-3 rounded-[2px] text-xs font-mono overflow-auto max-h-40 ${
              actionResult.ok
                ? 'bg-green-500/10 border border-green-500/20 text-green-300'
                : 'bg-red-500/10 border border-red-500/20 text-red-300'
            }`}>
              <div className="text-slate-400 mb-1 font-sans text-[10px] uppercase">{actionResult.action} result</div>
              <pre className="whitespace-pre-wrap">{actionResult.result}</pre>
            </div>
          )}
        </div>

        {/* Activity Panel */}
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-[2px] p-5">
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Recent Activity</h3>

          <div className="space-y-4">
            <ActivityItem
              icon={Search}
              label="Last Search"
              time={timeAgo(status?.last_search?.ran_at)}
              details={status?.last_search ? `processed: ${status.last_search.processed ?? 0}, conns: ${status.last_search.connections_sent ?? 0}, emails: ${status.last_search.emails_sent ?? 0}` : null}
            />
            <ActivityItem
              icon={UserPlus}
              label="Last Followup"
              time={timeAgo(status?.last_followup?.ran_at)}
              details={status?.last_followup ? `checked: ${status.last_followup.checked ?? 0}, messages: ${status.last_followup.messages_sent ?? 0}` : null}
            />
            <ActivityItem
              icon={Send}
              label="Last Publish"
              time={timeAgo(status?.last_publish?.ran_at)}
              details={status?.last_publish ? `topic: ${status.last_publish.topic ?? '—'}, ${status.last_publish.status ?? 'unknown'}` : null}
            />
            <ActivityItem
              icon={Bot}
              label="Last Self-Improve"
              time={timeAgo(status?.last_improve?.ran_at)}
              details={status?.last_improve ? `status: ${status.last_improve.status ?? 'unknown'}` : null}
            />
          </div>
        </div>
      </div>

      {/* Jobs + Publisher */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Scheduled Jobs */}
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-[2px] p-5">
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Scheduled Jobs</h3>
          {status?.scheduler?.jobs && status.scheduler.jobs.length > 0 ? (
            <div className="space-y-2">
              {status.scheduler.jobs.map((job) => (
                <div key={job.id} className="flex items-center justify-between py-2 border-b border-slate-700/30 last:border-0">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-slate-500" />
                    <span className="text-sm text-white font-medium">{job.id}</span>
                  </div>
                  <span className="text-sm text-slate-400">{formatNextRun(job.next_run)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">No scheduled jobs found</p>
          )}
        </div>

        {/* Publisher Stats */}
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-[2px] p-5">
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Publisher Stats</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-400">Total Posts</span>
              <span className="text-sm text-white font-bold">{status?.publisher_stats?.total_posts ?? 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-400">Publisher Enabled</span>
              <StatusBadge label={status?.publisher_stats?.enabled ? 'Yes' : 'No'} active={status?.publisher_stats?.enabled ?? false} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-400">AI Provider</span>
              <span className="text-sm text-white">{status?.publisher_stats?.ai_provider ?? '—'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Workflow Diagram */}
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-[2px] p-5">
        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Workflow</h3>
        <div className="flex items-center justify-center gap-2 flex-wrap py-3">
          {['Search Leads', 'Send Email', 'Connect', 'Outreach', 'Lead'].map((step, i, arr) => (
            <React.Fragment key={step}>
              <div className="flex items-center gap-2 px-4 py-2 bg-slate-900/60 border border-slate-700/40 rounded-[2px]">
                <span className="text-sm text-white font-medium">{step}</span>
              </div>
              {i < arr.length - 1 && <ArrowRight className="w-4 h-4 text-slate-600 flex-shrink-0" />}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
};

/* ---- Sub-components ---- */

const StatusBadge: React.FC<{ label: string; active: boolean }> = ({ label, active }) => (
  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
    active
      ? 'bg-green-500/10 text-green-400 border border-green-500/20'
      : 'bg-red-500/10 text-red-400 border border-red-500/20'
  }`}>
    <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-green-400' : 'bg-red-400'}`} />
    {label}
  </span>
);

const ActionButton: React.FC<{
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  loading: boolean;
  disabled: boolean;
  onClick: () => void;
  variant?: 'primary' | 'secondary';
}> = ({ icon: Icon, label, loading, disabled, onClick, variant = 'primary' }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`flex items-center justify-center gap-2 py-2.5 rounded-[2px] text-sm font-medium transition-colors disabled:opacity-50 ${
      variant === 'primary'
        ? 'bg-slate-700/50 border border-slate-600/50 text-slate-200 hover:bg-slate-600/50'
        : 'bg-slate-800/50 border border-slate-700/30 text-slate-400 hover:bg-slate-700/50 hover:text-slate-200'
    }`}
  >
    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Icon className="w-4 h-4" />}
    {label}
  </button>
);

const ActivityItem: React.FC<{
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  time: string;
  details: string | null;
}> = ({ icon: Icon, label, time, details }) => (
  <div className="flex items-start gap-3 p-3 rounded-[2px] bg-slate-900/30 border border-slate-700/30">
    <div className="mt-0.5 p-1.5 rounded-[2px] bg-slate-800 border border-slate-700/50">
      <Icon className="w-4 h-4 text-slate-400" />
    </div>
    <div className="flex-1 min-w-0">
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-sm text-white font-medium">{label}</span>
        <span className="text-xs text-slate-500">{time}</span>
      </div>
      {details ? (
        <p className="text-xs text-slate-400 font-mono">{details}</p>
      ) : (
        <p className="text-xs text-slate-600 italic">No data yet</p>
      )}
    </div>
  </div>
);

const CookieUploadButton: React.FC<{
  disabled: boolean;
  loading: boolean;
  onUpload: (cookies: unknown[]) => void;
}> = ({ disabled, loading, onUpload }) => {
  const inputRef = React.useRef<HTMLInputElement>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const cookies = JSON.parse(text);
      onUpload(Array.isArray(cookies) ? cookies : [cookies]);
    } catch {
      alert('Invalid cookie JSON file');
    }
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <>
      <input ref={inputRef} type="file" accept=".json" className="hidden" onChange={handleFile} />
      <button
        onClick={() => inputRef.current?.click()}
        disabled={disabled}
        className="flex items-center justify-center gap-2 py-2.5 rounded-[2px] text-sm font-medium bg-slate-800/50 border border-slate-700/30 text-slate-400 hover:bg-slate-700/50 hover:text-slate-200 transition-colors disabled:opacity-50"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Cookie className="w-4 h-4" />}
        Cookies
      </button>
    </>
  );
};

export default BotDashboard;
