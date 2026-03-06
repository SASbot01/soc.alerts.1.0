import React, { useEffect, useState } from 'react';
import {
    Database, Server, CheckCircle, XCircle, AlertTriangle,
    Clock, HardDrive, RefreshCw, Plus, Trash2, Play, Users, FolderSync,
    Wifi, WifiOff, Activity
} from 'lucide-react';
import api from '../lib/api';

// ===== Backup Monitor Tab =====
const BackupTab: React.FC = () => {
    const [dashboard, setDashboard] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    const fetchData = () => {
        setLoading(true);
        api.get('/backups/dashboard').then(r => {
            setDashboard(r.data);
            setLoading(false);
        }).catch(() => setLoading(false));
    };

    useEffect(() => { fetchData(); }, []);

    if (loading) return <div className="flex items-center justify-center h-64 text-slate-400">Loading backups...</div>;
    if (!dashboard) return <div className="text-center text-slate-500 py-12">No backup data available</div>;

    const statusIcon = (status: string) => {
        switch (status) {
            case 'SUCCESS': return <CheckCircle className="w-5 h-5 text-green-400" />;
            case 'FAILED': return <XCircle className="w-5 h-5 text-red-400" />;
            case 'STALE': return <AlertTriangle className="w-5 h-5 text-yellow-400" />;
            case 'RUNNING': return <RefreshCw className="w-5 h-5 text-blue-400 animate-spin" />;
            default: return <Clock className="w-5 h-5 text-slate-400" />;
        }
    };

    const statusColor = (status: string) => {
        switch (status) {
            case 'SUCCESS': return 'text-green-400';
            case 'FAILED': return 'text-red-400';
            case 'STALE': return 'text-yellow-400';
            default: return 'text-slate-400';
        }
    };

    const formatBytes = (bytes: number) => {
        if (!bytes) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    };

    return (
        <div className="space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    { label: 'Total Jobs', value: dashboard.totalJobs, icon: Database, color: 'text-blue-400' },
                    { label: 'Success', value: dashboard.successCount, icon: CheckCircle, color: 'text-green-400' },
                    { label: 'Failed', value: dashboard.failedCount, icon: XCircle, color: 'text-red-400' },
                    { label: 'Total Size', value: formatBytes(dashboard.totalSizeBytes), icon: HardDrive, color: 'text-purple-400' },
                ].map((stat, i) => (
                    <div key={i} className="bg-slate-800/50 border border-slate-700/50 rounded-[2px] p-4">
                        <div className="flex items-center gap-2 mb-2">
                            <stat.icon className={`w-5 h-5 ${stat.color}`} />
                            <span className="text-xs text-slate-400 uppercase tracking-wider">{stat.label}</span>
                        </div>
                        <div className="text-2xl font-bold text-white">{stat.value}</div>
                    </div>
                ))}
            </div>

            {/* Hosts */}
            {dashboard.hosts?.length > 0 && (
                <div className="bg-slate-800/50 border border-slate-700/50 rounded-[2px] p-4">
                    <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-3">Hosts</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {dashboard.hosts.map((h: any, i: number) => (
                            <div key={i} className="bg-slate-900/50 border border-slate-700/30 rounded-[2px] p-3">
                                <div className="flex items-center gap-2 mb-2">
                                    <Server className="w-4 h-4 text-slate-400" />
                                    <span className="font-mono text-sm text-white">{h.host}</span>
                                </div>
                                <div className="flex gap-4 text-xs">
                                    <span className="text-green-400">{h.successJobs} ok</span>
                                    <span className="text-red-400">{h.failedJobs} failed</span>
                                    <span className="text-slate-500">{h.totalJobs} total</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Jobs Table */}
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-[2px] overflow-hidden">
                <div className="p-4 border-b border-slate-700/50 flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider">Recent Backup Jobs</h3>
                    <button onClick={fetchData} className="p-2 text-slate-400 hover:text-white rounded-[2px] hover:bg-slate-700/50">
                        <RefreshCw className="w-4 h-4" />
                    </button>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-900/50 text-xs text-slate-400 uppercase">
                            <tr>
                                <th className="text-left p-3">Status</th>
                                <th className="text-left p-3">Host</th>
                                <th className="text-left p-3">Job</th>
                                <th className="text-left p-3">Type</th>
                                <th className="text-left p-3">Size</th>
                                <th className="text-left p-3">Duration</th>
                                <th className="text-left p-3">Time</th>
                                <th className="text-left p-3">Error</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700/30">
                            {dashboard.jobs?.map((job: any) => (
                                <tr key={job.id} className="hover:bg-slate-700/20">
                                    <td className="p-3">
                                        <div className="flex items-center gap-2">
                                            {statusIcon(job.status)}
                                            <span className={`font-mono text-xs ${statusColor(job.status)}`}>{job.status}</span>
                                        </div>
                                    </td>
                                    <td className="p-3 font-mono text-xs text-slate-300">{job.clientHost}</td>
                                    <td className="p-3 text-white">{job.jobName}</td>
                                    <td className="p-3 text-slate-400">{job.backupType}</td>
                                    <td className="p-3 text-slate-300">{formatBytes(job.sizeBytes)}</td>
                                    <td className="p-3 text-slate-400">{job.durationSeconds ? `${job.durationSeconds}s` : '-'}</td>
                                    <td className="p-3 text-slate-400 text-xs">{job.reportedAt ? new Date(job.reportedAt).toLocaleString() : '-'}</td>
                                    <td className="p-3 text-red-400 text-xs truncate max-w-[200px]">{job.errorMessage || '-'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

// ===== Health Checks Tab =====
const HealthChecksTab: React.FC = () => {
    const [dashboard, setDashboard] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);
    const [running, setRunning] = useState<string | null>(null);
    const [form, setForm] = useState({ name: '', checkType: 'HTTP', target: '', port: '', expectedStatus: '200', timeoutMs: '5000', intervalSeconds: '300' });

    const fetchData = () => {
        setLoading(true);
        api.get('/health-checks/dashboard').then(r => {
            setDashboard(r.data);
            setLoading(false);
        }).catch(() => setLoading(false));
    };

    useEffect(() => { fetchData(); }, []);

    const createTarget = () => {
        api.post('/health-checks/targets', {
            ...form,
            port: form.port ? parseInt(form.port) : null,
            expectedStatus: parseInt(form.expectedStatus),
            timeoutMs: parseInt(form.timeoutMs),
            intervalSeconds: parseInt(form.intervalSeconds),
        }).then(() => { setShowCreate(false); fetchData(); });
    };

    const deleteTarget = (id: string) => {
        api.delete(`/health-checks/targets/${id}`).then(() => fetchData());
    };

    const runCheck = (id: string) => {
        setRunning(id);
        api.post(`/health-checks/targets/${id}/run`).then(() => {
            fetchData();
            setRunning(null);
        }).catch(() => setRunning(null));
    };

    const runAll = () => {
        setRunning('all');
        api.post('/health-checks/run-all').then(() => {
            fetchData();
            setRunning(null);
        }).catch(() => setRunning(null));
    };

    if (loading) return <div className="flex items-center justify-center h-64 text-slate-400">Loading health checks...</div>;

    const statusIcon = (status: string) => {
        switch (status) {
            case 'OK': return <Wifi className="w-5 h-5 text-green-400" />;
            case 'FAIL': return <WifiOff className="w-5 h-5 text-red-400" />;
            case 'TIMEOUT': return <Clock className="w-5 h-5 text-yellow-400" />;
            case 'ERROR': return <XCircle className="w-5 h-5 text-red-400" />;
            default: return <Activity className="w-5 h-5 text-slate-500" />;
        }
    };

    return (
        <div className="space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    { label: 'Total Targets', value: dashboard?.totalTargets || 0, icon: Server, color: 'text-blue-400' },
                    { label: 'Healthy', value: dashboard?.healthyCount || 0, icon: CheckCircle, color: 'text-green-400' },
                    { label: 'Failing', value: dashboard?.failingCount || 0, icon: XCircle, color: 'text-red-400' },
                    { label: 'Unknown', value: dashboard?.unknownCount || 0, icon: AlertTriangle, color: 'text-yellow-400' },
                ].map((stat, i) => (
                    <div key={i} className="bg-slate-800/50 border border-slate-700/50 rounded-[2px] p-4">
                        <div className="flex items-center gap-2 mb-2">
                            <stat.icon className={`w-5 h-5 ${stat.color}`} />
                            <span className="text-xs text-slate-400 uppercase tracking-wider">{stat.label}</span>
                        </div>
                        <div className="text-2xl font-bold text-white">{stat.value}</div>
                    </div>
                ))}
            </div>

            {/* Actions */}
            <div className="flex gap-3">
                <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2 bg-primary-500/20 text-primary-400 border border-primary-500/30 rounded-[2px] hover:bg-primary-500/30 text-sm">
                    <Plus className="w-4 h-4" /> Add Target
                </button>
                <button onClick={runAll} disabled={running === 'all'} className="flex items-center gap-2 px-4 py-2 bg-green-500/20 text-green-400 border border-green-500/30 rounded-[2px] hover:bg-green-500/30 text-sm disabled:opacity-50">
                    <Play className="w-4 h-4" /> {running === 'all' ? 'Running...' : 'Run All Checks'}
                </button>
                <button onClick={fetchData} className="p-2 text-slate-400 hover:text-white rounded-[2px] hover:bg-slate-700/50">
                    <RefreshCw className="w-4 h-4" />
                </button>
            </div>

            {/* Create form */}
            {showCreate && (
                <div className="bg-slate-800/50 border border-slate-700/50 rounded-[2px] p-4 space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <input placeholder="Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                            className="bg-slate-900 border border-slate-700 rounded-[2px] px-3 py-2 text-sm text-white" />
                        <select value={form.checkType} onChange={e => setForm({ ...form, checkType: e.target.value })}
                            className="bg-slate-900 border border-slate-700 rounded-[2px] px-3 py-2 text-sm text-white">
                            <option value="HTTP">HTTP</option>
                            <option value="TCP">TCP</option>
                            <option value="PING">PING</option>
                            <option value="DNS">DNS</option>
                        </select>
                        <input placeholder="Target (URL/IP/hostname)" value={form.target} onChange={e => setForm({ ...form, target: e.target.value })}
                            className="bg-slate-900 border border-slate-700 rounded-[2px] px-3 py-2 text-sm text-white" />
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <input placeholder="Port" value={form.port} onChange={e => setForm({ ...form, port: e.target.value })}
                            className="bg-slate-900 border border-slate-700 rounded-[2px] px-3 py-2 text-sm text-white" />
                        <input placeholder="Expected Status" value={form.expectedStatus} onChange={e => setForm({ ...form, expectedStatus: e.target.value })}
                            className="bg-slate-900 border border-slate-700 rounded-[2px] px-3 py-2 text-sm text-white" />
                        <input placeholder="Timeout (ms)" value={form.timeoutMs} onChange={e => setForm({ ...form, timeoutMs: e.target.value })}
                            className="bg-slate-900 border border-slate-700 rounded-[2px] px-3 py-2 text-sm text-white" />
                        <input placeholder="Interval (s)" value={form.intervalSeconds} onChange={e => setForm({ ...form, intervalSeconds: e.target.value })}
                            className="bg-slate-900 border border-slate-700 rounded-[2px] px-3 py-2 text-sm text-white" />
                    </div>
                    <div className="flex gap-2">
                        <button onClick={createTarget} className="px-4 py-2 bg-primary-500 text-white rounded-[2px] text-sm hover:bg-primary-600">Create</button>
                        <button onClick={() => setShowCreate(false)} className="px-4 py-2 bg-slate-700 text-slate-300 rounded-[2px] text-sm hover:bg-slate-600">Cancel</button>
                    </div>
                </div>
            )}

            {/* Targets Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {dashboard?.targets?.map((t: any) => (
                    <div key={t.id} className={`bg-slate-800/50 border rounded-[2px] p-4 ${t.lastStatus === 'OK' ? 'border-green-500/20' : t.lastStatus === 'FAIL' || t.lastStatus === 'ERROR' ? 'border-red-500/20' : 'border-slate-700/50'}`}>
                        <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-2">
                                {statusIcon(t.lastStatus)}
                                <div>
                                    <div className="text-white font-medium">{t.name}</div>
                                    <div className="text-xs text-slate-400">{t.checkType} - {t.target}{t.port ? `:${t.port}` : ''}</div>
                                </div>
                            </div>
                            <div className="flex gap-1">
                                <button onClick={() => runCheck(t.id)} disabled={running === t.id} className="p-1.5 text-slate-400 hover:text-green-400 rounded-[2px] hover:bg-slate-700/50">
                                    <Play className={`w-3.5 h-3.5 ${running === t.id ? 'animate-spin' : ''}`} />
                                </button>
                                <button onClick={() => deleteTarget(t.id)} className="p-1.5 text-slate-400 hover:text-red-400 rounded-[2px] hover:bg-slate-700/50">
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </div>
                        <div className="space-y-1 text-xs">
                            {t.lastResponseTimeMs != null && (
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Response</span>
                                    <span className="text-slate-300">{t.lastResponseTimeMs}ms</span>
                                </div>
                            )}
                            <div className="flex justify-between">
                                <span className="text-slate-500">Uptime 24h</span>
                                <span className={t.uptimePercent >= 99 ? 'text-green-400' : t.uptimePercent >= 90 ? 'text-yellow-400' : 'text-red-400'}>
                                    {t.uptimePercent}%
                                </span>
                            </div>
                            {t.lastCheckedAt && (
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Last check</span>
                                    <span className="text-slate-400">{new Date(t.lastCheckedAt).toLocaleString()}</span>
                                </div>
                            )}
                            {t.lastError && (
                                <div className="text-red-400 mt-1 truncate" title={t.lastError}>{t.lastError}</div>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {(!dashboard?.targets || dashboard.targets.length === 0) && (
                <div className="text-center text-slate-500 py-12">
                    No health check targets configured. Add one to start monitoring.
                </div>
            )}
        </div>
    );
};

// ===== LDAP Tab =====
const LdapTab: React.FC = () => {
    const [config, setConfig] = useState<any>(null);
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [csvText, setCsvText] = useState('');
    const [syncResult, setSyncResult] = useState<any>(null);
    const [syncing, setSyncing] = useState(false);

    useEffect(() => {
        Promise.all([
            api.get('/ldap/config').then(r => setConfig(r.data)).catch(() => {}),
            api.get('/ldap/sync-logs').then(r => setLogs(r.data)).catch(() => {}),
        ]).finally(() => setLoading(false));
    }, []);

    const bulkCreate = () => {
        const lines = csvText.trim().split('\n');
        if (lines.length < 2) return;

        const headers = lines[0].split(',').map(h => h.trim());
        const users = lines.slice(1).map(line => {
            const vals = line.split(',').map(v => v.trim());
            const user: any = {};
            headers.forEach((h, i) => { user[h] = vals[i] || ''; });
            return user;
        }).filter(u => u.username);

        setSyncing(true);
        api.post('/ldap/users/bulk', { users }).then(r => {
            setSyncResult(r.data);
            setSyncing(false);
            // Refresh logs
            api.get('/ldap/sync-logs').then(r => setLogs(r.data));
        }).catch(() => setSyncing(false));
    };

    if (loading) return <div className="flex items-center justify-center h-64 text-slate-400">Loading LDAP config...</div>;

    return (
        <div className="space-y-6">
            {/* Connection Status */}
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-[2px] p-4">
                <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-3">LDAP Connection (lldap)</h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
                    <div>
                        <span className="text-slate-500">URL</span>
                        <div className="text-white font-mono">{config?.ldapUrl || 'N/A'}</div>
                    </div>
                    <div>
                        <span className="text-slate-500">Admin</span>
                        <div className="text-white">{config?.adminUser || 'N/A'}</div>
                    </div>
                    <div>
                        <span className="text-slate-500">Base DN</span>
                        <div className="text-white font-mono">{config?.baseDn || 'N/A'}</div>
                    </div>
                    <div>
                        <span className="text-slate-500">Status</span>
                        <div className={`flex items-center gap-2 ${config?.connected ? 'text-green-400' : 'text-red-400'}`}>
                            {config?.connected ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                            {config?.connected ? 'Connected' : 'Disconnected'}
                        </div>
                    </div>
                </div>
            </div>

            {/* Bulk Create */}
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-[2px] p-4">
                <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-3">Bulk Create Users (CSV)</h3>
                <p className="text-xs text-slate-500 mb-2">Format: username,email,displayName,group,password</p>
                <textarea
                    value={csvText}
                    onChange={e => setCsvText(e.target.value)}
                    placeholder={`username,email,displayName,group,password\njgarcia,jgarcia@empresa.com,Juan Garcia,soc-analysts,TempPass123!`}
                    rows={6}
                    className="w-full bg-slate-900 border border-slate-700 rounded-[2px] px-3 py-2 text-sm text-white font-mono"
                />
                <button onClick={bulkCreate} disabled={syncing || !csvText.trim()} className="mt-2 flex items-center gap-2 px-4 py-2 bg-primary-500/20 text-primary-400 border border-primary-500/30 rounded-[2px] hover:bg-primary-500/30 text-sm disabled:opacity-50">
                    <FolderSync className="w-4 h-4" /> {syncing ? 'Creating...' : 'Create Users'}
                </button>

                {syncResult && (
                    <div className="mt-3 p-3 bg-slate-900/50 rounded-[2px] border border-slate-700/30">
                        <div className="flex gap-4 mb-2 text-sm">
                            <span className="text-green-400">Created: {syncResult.created}</span>
                            <span className="text-red-400">Failed: {syncResult.failed}</span>
                        </div>
                        {syncResult.results?.map((r: any, i: number) => (
                            <div key={i} className="flex items-center gap-2 text-xs py-1">
                                {r.status === 'SUCCESS'
                                    ? <CheckCircle className="w-3.5 h-3.5 text-green-400" />
                                    : <XCircle className="w-3.5 h-3.5 text-red-400" />}
                                <span className="text-slate-300">{r.username}</span>
                                {r.error && <span className="text-red-400 ml-2">{r.error}</span>}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Sync Logs */}
            {logs.length > 0 && (
                <div className="bg-slate-800/50 border border-slate-700/50 rounded-[2px] overflow-hidden">
                    <div className="p-4 border-b border-slate-700/50">
                        <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider">Sync History</h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-900/50 text-xs text-slate-400 uppercase">
                                <tr>
                                    <th className="text-left p-3">Action</th>
                                    <th className="text-left p-3">User</th>
                                    <th className="text-left p-3">Group</th>
                                    <th className="text-left p-3">Status</th>
                                    <th className="text-left p-3">By</th>
                                    <th className="text-left p-3">Time</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-700/30">
                                {logs.slice(0, 50).map((l: any) => (
                                    <tr key={l.id} className="hover:bg-slate-700/20">
                                        <td className="p-3 text-white">{l.action}</td>
                                        <td className="p-3 font-mono text-xs text-slate-300">{l.username}</td>
                                        <td className="p-3 text-slate-400">{l.ldapGroup || '-'}</td>
                                        <td className="p-3">
                                            <span className={l.status === 'SUCCESS' ? 'text-green-400' : 'text-red-400'}>{l.status}</span>
                                        </td>
                                        <td className="p-3 text-slate-400">{l.performedBy}</td>
                                        <td className="p-3 text-slate-400 text-xs">{l.performedAt ? new Date(l.performedAt).toLocaleString() : '-'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

// ===== Main Infrastructure Page =====
const Infrastructure: React.FC = () => {
    const [tab, setTab] = useState<'backups' | 'health' | 'ldap'>('backups');

    const tabs = [
        { id: 'backups' as const, label: 'Backups', icon: Database },
        { id: 'health' as const, label: 'Health Checks', icon: Activity },
        { id: 'ldap' as const, label: 'LDAP Directory', icon: Users },
    ];

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-white">Infrastructure</h1>
                <p className="text-slate-400 text-sm mt-1">Backup monitoring, health checks, and LDAP directory management</p>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-slate-800/50 border border-slate-700/50 rounded-[2px] p-1 w-fit">
                {tabs.map(t => (
                    <button key={t.id} onClick={() => setTab(t.id)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-[2px] text-sm transition-all ${tab === t.id ? 'bg-primary-500/20 text-primary-400 border border-primary-500/30' : 'text-slate-400 hover:text-white hover:bg-slate-700/50'}`}>
                        <t.icon className="w-4 h-4" />
                        {t.label}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            {tab === 'backups' && <BackupTab />}
            {tab === 'health' && <HealthChecksTab />}
            {tab === 'ldap' && <LdapTab />}
        </div>
    );
};

export default Infrastructure;
