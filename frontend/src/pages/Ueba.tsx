import React, { useEffect, useState } from 'react';
import { Activity, AlertTriangle, Eye, EyeOff, Users } from 'lucide-react';
import api from '../lib/api';

interface BehaviorProfile {
  id: string;
  entityType: string;
  entityId: string;
  riskScore: number;
  totalEvents: number;
  anomalyCount: number;
  lastActivityAt: string | null;
}

interface Anomaly {
  id: string;
  profileId: string;
  anomalyType: string;
  anomalyScore: number;
  description: string;
  isReviewed: boolean;
  detectedAt: string;
}

interface Stats {
  totalProfiles: number;
  highRiskCount: number;
  unreviewedAnomalies: number;
  recentAnomalies: Anomaly[];
}

const uebaService = {
  profiles: () => api.get('/ueba/profiles').then(r => r.data),
  anomalies: () => api.get('/ueba/anomalies').then(r => r.data),
  review: (id: string) => api.post(`/ueba/anomalies/${id}/review`).then(r => r.data),
  stats: () => api.get('/ueba/stats').then(r => r.data),
};

const Ueba: React.FC = () => {
  const [profiles, setProfiles] = useState<BehaviorProfile[]>([]);
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'profiles' | 'anomalies'>('profiles');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [p, a, s] = await Promise.all([
        uebaService.profiles(),
        uebaService.anomalies(),
        uebaService.stats(),
      ]);
      setProfiles(p);
      setAnomalies(a);
      setStats(s);
    } catch (err) {
      console.error('Failed to load UEBA data:', err);
    } finally {
      setLoading(false);
    }
  };

  const reviewAnomaly = async (id: string) => {
    try {
      await uebaService.review(id);
      loadData();
    } catch (err) {
      console.error('Failed to review anomaly:', err);
    }
  };

  const riskColor = (score: number) => {
    if (score >= 70) return 'text-red-400 bg-red-500/10';
    if (score >= 40) return 'text-amber-400 bg-amber-500/10';
    return 'text-green-400 bg-green-500/10';
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-slate-400">Loading UEBA data...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Activity className="w-7 h-7 text-primary-400" />
          Behavioral Analytics (UEBA)
        </h1>
        <p className="text-slate-400 text-sm mt-1">User and entity behavior analysis with anomaly detection</p>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
            <div className="flex items-center gap-2 text-slate-400 text-sm"><Users className="w-4 h-4" />Entity Profiles</div>
            <div className="text-2xl font-bold text-white mt-1">{stats.totalProfiles}</div>
          </div>
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
            <div className="flex items-center gap-2 text-red-400 text-sm"><AlertTriangle className="w-4 h-4" />High Risk</div>
            <div className="text-2xl font-bold text-red-400 mt-1">{stats.highRiskCount}</div>
          </div>
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
            <div className="flex items-center gap-2 text-amber-400 text-sm"><Eye className="w-4 h-4" />Unreviewed Anomalies</div>
            <div className="text-2xl font-bold text-amber-400 mt-1">{stats.unreviewedAnomalies}</div>
          </div>
        </div>
      )}

      {/* Tab switcher */}
      <div className="flex gap-2">
        <button
          onClick={() => setTab('profiles')}
          className={`px-4 py-2 rounded text-sm font-medium transition ${tab === 'profiles' ? 'bg-primary-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
        >
          Entity Profiles ({profiles.length})
        </button>
        <button
          onClick={() => setTab('anomalies')}
          className={`px-4 py-2 rounded text-sm font-medium transition ${tab === 'anomalies' ? 'bg-primary-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
        >
          Anomalies ({anomalies.length})
        </button>
      </div>

      {tab === 'profiles' && (
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="text-xs text-slate-400 uppercase tracking-wider border-b border-slate-700">
                <th className="text-left p-3">Entity</th>
                <th className="text-left p-3">Type</th>
                <th className="text-left p-3">Risk Score</th>
                <th className="text-left p-3">Events</th>
                <th className="text-left p-3">Anomalies</th>
                <th className="text-left p-3">Last Activity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {profiles.map(p => (
                <tr key={p.id} className="hover:bg-slate-800/50 transition">
                  <td className="p-3 text-white font-mono">{p.entityId}</td>
                  <td className="p-3 text-sm text-slate-400">{p.entityType}</td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${riskColor(p.riskScore)}`}>
                      {p.riskScore.toFixed(0)}
                    </span>
                  </td>
                  <td className="p-3 text-sm text-white">{p.totalEvents?.toLocaleString()}</td>
                  <td className="p-3 text-sm text-white">{p.anomalyCount}</td>
                  <td className="p-3 text-sm text-slate-400">
                    {p.lastActivityAt ? new Date(p.lastActivityAt).toLocaleString() : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {profiles.length === 0 && (
            <div className="p-8 text-center text-slate-500">No entity profiles yet. Profiles are created automatically as events flow in.</div>
          )}
        </div>
      )}

      {tab === 'anomalies' && (
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="text-xs text-slate-400 uppercase tracking-wider border-b border-slate-700">
                <th className="text-left p-3">Detected</th>
                <th className="text-left p-3">Type</th>
                <th className="text-left p-3">Score</th>
                <th className="text-left p-3">Description</th>
                <th className="text-left p-3">Status</th>
                <th className="text-right p-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {anomalies.map(a => (
                <tr key={a.id} className="hover:bg-slate-800/50 transition">
                  <td className="p-3 text-sm text-slate-300 whitespace-nowrap">
                    {new Date(a.detectedAt).toLocaleString()}
                  </td>
                  <td className="p-3 text-sm text-white font-mono">{a.anomalyType}</td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${riskColor(a.anomalyScore)}`}>
                      {a.anomalyScore.toFixed(0)}
                    </span>
                  </td>
                  <td className="p-3 text-sm text-slate-400 max-w-md truncate">{a.description}</td>
                  <td className="p-3">
                    {a.isReviewed
                      ? <span className="text-xs text-green-400 flex items-center gap-1"><EyeOff className="w-3 h-3" />Reviewed</span>
                      : <span className="text-xs text-amber-400 flex items-center gap-1"><Eye className="w-3 h-3" />Pending</span>
                    }
                  </td>
                  <td className="p-3 text-right">
                    {!a.isReviewed && (
                      <button
                        onClick={() => reviewAnomaly(a.id)}
                        className="px-3 py-1 text-xs bg-slate-700 text-white rounded hover:bg-slate-600 transition"
                      >
                        Mark Reviewed
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {anomalies.length === 0 && (
            <div className="p-8 text-center text-slate-500">No anomalies detected yet.</div>
          )}
        </div>
      )}
    </div>
  );
};

export default Ueba;
