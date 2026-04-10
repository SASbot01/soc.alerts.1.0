import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { Plus, Trash2, RefreshCw, Shield, Rss, Activity, Clock, X } from 'lucide-react';

interface IOC {
  id: string;
  iocType: string;
  value: string;
  source: string;
  confidence: number;
  severity: string;
  firstSeen: string;
  lastSeen: string;
  active: boolean;
}

interface Feed {
  id: string;
  name: string;
  url: string;
  feedType: string;
  enabled: boolean;
  lastPoll: string | null;
  iocCount: number;
  pollInterval: number;
}

interface ThreatIntelStats {
  totalIocs: number;
  activeIocs: number;
  totalFeeds: number;
  lastUpdate: string | null;
}

const severityBadge = (s: string) => {
  const v = s?.toLowerCase();
  if (v === 'critical') return 'bg-red-600 text-white';
  if (v === 'high') return 'bg-red-500/20 text-red-400 border border-red-500/40';
  if (v === 'medium') return 'bg-amber-500/20 text-amber-400 border border-amber-500/40';
  if (v === 'low') return 'bg-blue-500/20 text-blue-400 border border-blue-500/40';
  return 'bg-slate-700 text-slate-300';
};

const inputCls = 'w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:border-blue-500 focus:outline-none placeholder-slate-500';
const labelCls = 'block text-xs text-slate-400 mb-1';

const ThreatIntel: React.FC = () => {
  const { user } = useAuth();
  const companyId = user?.companyId;
  const token = localStorage.getItem('token');

  const [activeTab, setActiveTab] = useState<'iocs' | 'feeds'>('iocs');
  const [iocs, setIocs] = useState<IOC[]>([]);
  const [feeds, setFeeds] = useState<Feed[]>([]);
  const [stats, setStats] = useState<ThreatIntelStats>({ totalIocs: 0, activeIocs: 0, totalFeeds: 0, lastUpdate: null });
  const [loading, setLoading] = useState(false);
  const [showIocForm, setShowIocForm] = useState(false);
  const [showFeedForm, setShowFeedForm] = useState(false);
  const [iocForm, setIocForm] = useState({ iocType: 'ip', value: '', source: '', confidence: 80, severity: 'medium' });
  const [feedForm, setFeedForm] = useState({ name: '', url: '', feedType: 'stix', pollInterval: 3600 });
  const [saving, setSaving] = useState(false);

  const api = (path: string, opts?: RequestInit) =>
    fetch(`/api/v1${path}`, {
      ...opts,
      headers: { ...opts?.headers, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    });

  const fetchAll = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const [iocsRes, feedsRes, statsRes] = await Promise.all([
        api(`/threat-intel/iocs?companyId=${companyId}`),
        api(`/threat-intel/feeds?companyId=${companyId}`),
        api(`/threat-intel/stats?companyId=${companyId}`),
      ]);
      if (iocsRes.ok) setIocs(await iocsRes.json());
      if (feedsRes.ok) setFeeds(await feedsRes.json());
      if (statsRes.ok) setStats(await statsRes.json());
    } catch (err) {
      console.error('Failed to load threat intel:', err);
    } finally {
      setLoading(false);
    }
  }, [companyId, token]);

  useEffect(() => { fetchAll(); }, []);

  const createIoc = async () => {
    if (!iocForm.value.trim() || !companyId) return;
    setSaving(true);
    try {
      const res = await api('/threat-intel/iocs', {
        method: 'POST',
        body: JSON.stringify({ ...iocForm, companyId }),
      });
      if (res.ok) {
        setShowIocForm(false);
        setIocForm({ iocType: 'ip', value: '', source: '', confidence: 80, severity: 'medium' });
        fetchAll();
      }
    } catch (err) {
      console.error('Failed to create IOC:', err);
    } finally {
      setSaving(false);
    }
  };

  const createFeed = async () => {
    if (!feedForm.name.trim() || !feedForm.url.trim() || !companyId) return;
    setSaving(true);
    try {
      const res = await api('/threat-intel/feeds', {
        method: 'POST',
        body: JSON.stringify({ ...feedForm, companyId }),
      });
      if (res.ok) {
        setShowFeedForm(false);
        setFeedForm({ name: '', url: '', feedType: 'stix', pollInterval: 3600 });
        fetchAll();
      }
    } catch (err) {
      console.error('Failed to create feed:', err);
    } finally {
      setSaving(false);
    }
  };

  const deleteFeed = async (id: string) => {
    try {
      await api(`/threat-intel/feeds/${id}`, { method: 'DELETE' });
      fetchAll();
    } catch (err) {
      console.error('Failed to delete feed:', err);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Threat Intelligence</h1>
          <p className="text-slate-400 text-sm mt-1">Manage IOCs, threat feeds, and intelligence sources</p>
        </div>
        <button
          onClick={fetchAll}
          className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-slate-300 rounded-lg border border-slate-700 hover:bg-slate-700 transition"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total IOCs', value: stats.totalIocs, icon: <Shield className="w-5 h-5 text-blue-400" />, color: 'text-blue-400' },
          { label: 'Active IOCs', value: stats.activeIocs, icon: <Activity className="w-5 h-5 text-green-400" />, color: 'text-green-400' },
          { label: 'Total Feeds', value: stats.totalFeeds, icon: <Rss className="w-5 h-5 text-purple-400" />, color: 'text-purple-400' },
          { label: 'Last Update', value: stats.lastUpdate ? new Date(stats.lastUpdate).toLocaleTimeString() : '—', icon: <Clock className="w-5 h-5 text-amber-400" />, color: 'text-amber-400' },
        ].map(s => (
          <div key={s.label} className="bg-slate-900 border border-slate-700 rounded-lg p-4 flex items-center gap-3">
            <div className="p-2 bg-slate-800 rounded-lg">{s.icon}</div>
            <div>
              <p className="text-slate-400 text-xs">{s.label}</p>
              <p className={`text-xl font-bold ${s.color}`}>{typeof s.value === 'number' ? s.value.toLocaleString() : s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="bg-slate-900 border border-slate-700 rounded-lg overflow-hidden">
        <div className="flex border-b border-slate-700">
          {(['iocs', 'feeds'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-3 text-sm font-medium transition ${
                activeTab === tab
                  ? 'text-white border-b-2 border-blue-500 bg-slate-800/50'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {tab === 'iocs' ? 'IOCs' : 'Feeds'}
            </button>
          ))}
        </div>

        {/* IOCs Tab */}
        {activeTab === 'iocs' && (
          <div>
            <div className="p-4 border-b border-slate-700 flex justify-between items-center">
              <span className="text-slate-300 text-sm">{iocs.length} indicators</span>
              <button
                onClick={() => setShowIocForm(!showIocForm)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm"
              >
                <Plus className="w-4 h-4" />
                Add IOC
              </button>
            </div>

            {showIocForm && (
              <div className="p-4 bg-slate-800/50 border-b border-slate-700">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-white font-medium">New Indicator of Compromise</h3>
                  <button onClick={() => setShowIocForm(false)} className="text-slate-400 hover:text-white"><X className="w-4 h-4" /></button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-3">
                  <div>
                    <label className={labelCls}>Type</label>
                    <select
                      value={iocForm.iocType}
                      onChange={e => setIocForm({ ...iocForm, iocType: e.target.value })}
                      className={inputCls}
                    >
                      <option value="ip">IP Address</option>
                      <option value="domain">Domain</option>
                      <option value="hash">File Hash</option>
                      <option value="url">URL</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Value</label>
                    <input
                      type="text"
                      value={iocForm.value}
                      onChange={e => setIocForm({ ...iocForm, value: e.target.value })}
                      placeholder="e.g. 192.168.1.1"
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Source</label>
                    <input
                      type="text"
                      value={iocForm.source}
                      onChange={e => setIocForm({ ...iocForm, source: e.target.value })}
                      placeholder="e.g. internal, OSINT"
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Severity</label>
                    <select
                      value={iocForm.severity}
                      onChange={e => setIocForm({ ...iocForm, severity: e.target.value })}
                      className={inputCls}
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="critical">Critical</option>
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className={labelCls}>Confidence: {iocForm.confidence}%</label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={iocForm.confidence}
                      onChange={e => setIocForm({ ...iocForm, confidence: Number(e.target.value) })}
                      className="w-full accent-blue-500"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={createIoc}
                    disabled={saving}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition text-sm"
                  >
                    {saving ? 'Saving...' : 'Create IOC'}
                  </button>
                  <button onClick={() => setShowIocForm(false)} className="px-4 py-2 text-slate-400 hover:text-white transition text-sm">
                    Cancel
                  </button>
                </div>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-slate-400 uppercase tracking-wider bg-slate-800/30">
                    <th className="text-left px-4 py-3">Type</th>
                    <th className="text-left px-4 py-3">Value</th>
                    <th className="text-left px-4 py-3">Source</th>
                    <th className="text-left px-4 py-3">Confidence</th>
                    <th className="text-left px-4 py-3">Severity</th>
                    <th className="text-left px-4 py-3">First Seen</th>
                    <th className="text-left px-4 py-3">Last Seen</th>
                    <th className="text-left px-4 py-3">Active</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                  {iocs.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-10 text-slate-500">No IOCs found. Add your first indicator.</td>
                    </tr>
                  ) : (
                    iocs.map(ioc => (
                      <tr key={ioc.id} className="hover:bg-slate-800/40 transition">
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 bg-slate-700 text-slate-300 rounded text-xs uppercase">{ioc.iocType}</span>
                        </td>
                        <td className="px-4 py-3 text-slate-300 font-mono text-xs max-w-xs truncate">{ioc.value}</td>
                        <td className="px-4 py-3 text-slate-400">{ioc.source}</td>
                        <td className="px-4 py-3 w-36">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-slate-700 rounded-full h-1.5">
                              <div
                                className="bg-blue-500 h-1.5 rounded-full"
                                style={{ width: `${ioc.confidence}%` }}
                              />
                            </div>
                            <span className="text-slate-400 text-xs w-8">{ioc.confidence}%</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${severityBadge(ioc.severity)}`}>
                            {ioc.severity}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">
                          {ioc.firstSeen ? new Date(ioc.firstSeen).toLocaleDateString() : '—'}
                        </td>
                        <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">
                          {ioc.lastSeen ? new Date(ioc.lastSeen).toLocaleDateString() : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${ioc.active ? 'bg-green-500/20 text-green-400' : 'bg-slate-700 text-slate-400'}`}>
                            {ioc.active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Feeds Tab */}
        {activeTab === 'feeds' && (
          <div>
            <div className="p-4 border-b border-slate-700 flex justify-between items-center">
              <span className="text-slate-300 text-sm">{feeds.length} feeds configured</span>
              <button
                onClick={() => setShowFeedForm(!showFeedForm)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm"
              >
                <Plus className="w-4 h-4" />
                Add Feed
              </button>
            </div>

            {showFeedForm && (
              <div className="p-4 bg-slate-800/50 border-b border-slate-700">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-white font-medium">Add Threat Intelligence Feed</h3>
                  <button onClick={() => setShowFeedForm(false)} className="text-slate-400 hover:text-white"><X className="w-4 h-4" /></button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                  <div>
                    <label className={labelCls}>Feed Name</label>
                    <input
                      type="text"
                      value={feedForm.name}
                      onChange={e => setFeedForm({ ...feedForm, name: e.target.value })}
                      placeholder="e.g. AlienVault OTX"
                      className={inputCls}
                    />
                  </div>
                  <div className="col-span-1 md:col-span-1">
                    <label className={labelCls}>URL</label>
                    <input
                      type="url"
                      value={feedForm.url}
                      onChange={e => setFeedForm({ ...feedForm, url: e.target.value })}
                      placeholder="https://..."
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Type</label>
                    <select
                      value={feedForm.feedType}
                      onChange={e => setFeedForm({ ...feedForm, feedType: e.target.value })}
                      className={inputCls}
                    >
                      <option value="stix">STIX</option>
                      <option value="taxii">TAXII</option>
                      <option value="csv">CSV</option>
                      <option value="misp">MISP</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Poll Interval (seconds)</label>
                    <input
                      type="number"
                      value={feedForm.pollInterval}
                      onChange={e => setFeedForm({ ...feedForm, pollInterval: Number(e.target.value) })}
                      min={60}
                      className={inputCls}
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={createFeed}
                    disabled={saving}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition text-sm"
                  >
                    {saving ? 'Saving...' : 'Add Feed'}
                  </button>
                  <button onClick={() => setShowFeedForm(false)} className="px-4 py-2 text-slate-400 hover:text-white transition text-sm">
                    Cancel
                  </button>
                </div>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-slate-400 uppercase tracking-wider bg-slate-800/30">
                    <th className="text-left px-4 py-3">Name</th>
                    <th className="text-left px-4 py-3">URL</th>
                    <th className="text-left px-4 py-3">Type</th>
                    <th className="text-left px-4 py-3">Status</th>
                    <th className="text-left px-4 py-3">Last Poll</th>
                    <th className="text-left px-4 py-3">IOC Count</th>
                    <th className="text-left px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                  {feeds.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-10 text-slate-500">No feeds configured. Add your first intelligence feed.</td>
                    </tr>
                  ) : (
                    feeds.map(feed => (
                      <tr key={feed.id} className="hover:bg-slate-800/40 transition">
                        <td className="px-4 py-3 text-white font-medium">{feed.name}</td>
                        <td className="px-4 py-3 text-slate-400 text-xs max-w-xs truncate font-mono">{feed.url}</td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 rounded text-xs uppercase">{feed.feedType}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${feed.enabled ? 'bg-green-500/20 text-green-400' : 'bg-slate-700 text-slate-400'}`}>
                            {feed.enabled ? 'Enabled' : 'Disabled'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">
                          {feed.lastPoll ? new Date(feed.lastPoll).toLocaleString() : 'Never'}
                        </td>
                        <td className="px-4 py-3 text-slate-300">{feed.iocCount?.toLocaleString() ?? 0}</td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => deleteFeed(feed.id)}
                            className="p-1.5 text-red-400 hover:bg-red-500/10 rounded transition"
                            title="Delete feed"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ThreatIntel;
