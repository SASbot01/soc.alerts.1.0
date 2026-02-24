import React, { useEffect, useState } from 'react';
import { huntingService } from '../lib/services';
import { Search, Play, Save, Trash2, Clock, Filter, ChevronDown, ChevronUp, BarChart3 } from 'lucide-react';

interface SavedHunt {
  id: string;
  name: string;
  description: string;
  queryConfig: string;
  huntType: string;
  scheduleCron: string | null;
  isActive: boolean;
  lastRunAt: string | null;
  lastResultCount: number | null;
  tags: string | null;
  createdAt: string;
}

interface SearchResult {
  id: string;
  srcIp: string;
  dstIp: string;
  threatType: string;
  severity: number;
  description: string;
  status: string;
  sensorId: string;
  timestamp: string;
}

const ThreatHunting: React.FC = () => {
  const [hunts, setHunts] = useState<SavedHunt[]>([]);
  const [_loading, setLoading] = useState(true);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [totalResults, setTotalResults] = useState(0);
  const [searching, setSearching] = useState(false);
  const [showBuilder, setShowBuilder] = useState(true);
  const [showSaved, setShowSaved] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [showSaveModal, setShowSaveModal] = useState(false);

  // Query builder state
  const [query, setQuery] = useState({
    q: '',
    srcIp: '',
    dstIp: '',
    threatType: '',
    sensorId: '',
    status: '',
    minSeverity: '',
    maxSeverity: '',
    from: '',
    to: '',
    size: 50,
  });

  useEffect(() => {
    loadHunts();
  }, []);

  const loadHunts = async () => {
    try {
      const data = await huntingService.list();
      setHunts(data);
    } catch (err) {
      console.error('Failed to load hunts:', err);
    } finally {
      setLoading(false);
    }
  };

  const executeSearch = async () => {
    setSearching(true);
    try {
      const cleanQuery: any = {};
      Object.entries(query).forEach(([k, v]) => {
        if (v !== '' && v !== null && v !== undefined) {
          cleanQuery[k] = k === 'minSeverity' || k === 'maxSeverity' || k === 'size'
            ? Number(v) : v;
        }
      });
      const data = await huntingService.search(cleanQuery);
      setSearchResults(data.hits || []);
      setTotalResults(data.total || 0);
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      setSearching(false);
    }
  };

  const saveHunt = async () => {
    if (!saveName.trim()) return;
    try {
      const cleanQuery: any = {};
      Object.entries(query).forEach(([k, v]) => {
        if (v !== '' && v !== null && v !== undefined) cleanQuery[k] = v;
      });
      await huntingService.create({
        name: saveName,
        queryConfig: cleanQuery,
        huntType: 'manual',
      });
      setShowSaveModal(false);
      setSaveName('');
      loadHunts();
    } catch (err) {
      console.error('Failed to save hunt:', err);
    }
  };

  const executeHunt = async (huntId: string) => {
    try {
      const result = await huntingService.execute(huntId);
      setSearchResults(result.results?.hits || []);
      setTotalResults(result.resultCount || 0);
      loadHunts();
    } catch (err) {
      console.error('Failed to execute hunt:', err);
    }
  };

  const deleteHunt = async (huntId: string) => {
    try {
      await huntingService.delete(huntId);
      loadHunts();
    } catch (err) {
      console.error('Failed to delete hunt:', err);
    }
  };

  const loadHuntQuery = (hunt: SavedHunt) => {
    try {
      const config = JSON.parse(hunt.queryConfig);
      setQuery({
        q: config.q || '',
        srcIp: config.srcIp || '',
        dstIp: config.dstIp || '',
        threatType: config.threatType || '',
        sensorId: config.sensorId || '',
        status: config.status || '',
        minSeverity: config.minSeverity?.toString() || '',
        maxSeverity: config.maxSeverity?.toString() || '',
        from: config.from || '',
        to: config.to || '',
        size: config.size || 50,
      });
      setShowBuilder(true);
    } catch {
      // ignore
    }
  };

  const severityColor = (s: number) => {
    if (s >= 8) return 'text-red-400 bg-red-500/10';
    if (s >= 5) return 'text-amber-400 bg-amber-500/10';
    return 'text-green-400 bg-green-500/10';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Threat Hunting</h1>
          <p className="text-slate-400 text-sm mt-1">Search and investigate threats across your environment</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowSaved(!showSaved)}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-slate-300 rounded hover:bg-slate-700 transition"
          >
            <Clock className="w-4 h-4" />
            Saved Hunts ({hunts.length})
          </button>
        </div>
      </div>

      {/* Query Builder */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-lg">
        <button
          onClick={() => setShowBuilder(!showBuilder)}
          className="flex items-center justify-between w-full p-4"
        >
          <div className="flex items-center gap-2 text-white font-medium">
            <Filter className="w-5 h-5 text-primary-400" />
            Query Builder
          </div>
          {showBuilder ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
        </button>

        {showBuilder && (
          <div className="p-4 pt-0 space-y-4">
            {/* Free text search */}
            <div>
              <label className="block text-xs text-slate-400 mb-1">Free Text Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  value={query.q}
                  onChange={e => setQuery({ ...query, q: e.target.value })}
                  placeholder="Search descriptions, threat types..."
                  className="w-full pl-10 pr-4 py-2 bg-slate-900 border border-slate-700 rounded text-white placeholder-slate-500 focus:border-primary-500 focus:outline-none"
                  onKeyDown={e => e.key === 'Enter' && executeSearch()}
                />
              </div>
            </div>

            {/* Filter grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Source IP</label>
                <input
                  type="text"
                  value={query.srcIp}
                  onChange={e => setQuery({ ...query, srcIp: e.target.value })}
                  placeholder="e.g. 192.168.1.1"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-white text-sm focus:border-primary-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Destination IP</label>
                <input
                  type="text"
                  value={query.dstIp}
                  onChange={e => setQuery({ ...query, dstIp: e.target.value })}
                  placeholder="e.g. 10.0.0.1"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-white text-sm focus:border-primary-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Threat Type</label>
                <input
                  type="text"
                  value={query.threatType}
                  onChange={e => setQuery({ ...query, threatType: e.target.value })}
                  placeholder="e.g. port_scan"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-white text-sm focus:border-primary-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Sensor ID</label>
                <input
                  type="text"
                  value={query.sensorId}
                  onChange={e => setQuery({ ...query, sensorId: e.target.value })}
                  placeholder="e.g. sensor-suricata"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-white text-sm focus:border-primary-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Min Severity</label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={query.minSeverity}
                  onChange={e => setQuery({ ...query, minSeverity: e.target.value })}
                  placeholder="1"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-white text-sm focus:border-primary-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Max Severity</label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={query.maxSeverity}
                  onChange={e => setQuery({ ...query, maxSeverity: e.target.value })}
                  placeholder="10"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-white text-sm focus:border-primary-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">From</label>
                <input
                  type="datetime-local"
                  value={query.from}
                  onChange={e => setQuery({ ...query, from: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-white text-sm focus:border-primary-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">To</label>
                <input
                  type="datetime-local"
                  value={query.to}
                  onChange={e => setQuery({ ...query, to: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-white text-sm focus:border-primary-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3">
              <button
                onClick={executeSearch}
                disabled={searching}
                className="flex items-center gap-2 px-6 py-2 bg-primary-600 text-white rounded hover:bg-primary-700 disabled:opacity-50 transition font-medium"
              >
                <Search className="w-4 h-4" />
                {searching ? 'Searching...' : 'Hunt'}
              </button>
              <button
                onClick={() => setShowSaveModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-slate-700 text-slate-300 rounded hover:bg-slate-600 transition"
              >
                <Save className="w-4 h-4" />
                Save Hunt
              </button>
              <span className="text-sm text-slate-500">
                Results: {totalResults.toLocaleString()}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Saved Hunts Panel */}
      {showSaved && (
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
          <h3 className="text-white font-medium mb-3 flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary-400" />
            Saved Hunts
          </h3>
          {hunts.length === 0 ? (
            <p className="text-slate-500 text-sm">No saved hunts yet. Create one by building a query and clicking Save Hunt.</p>
          ) : (
            <div className="space-y-2">
              {hunts.map(hunt => (
                <div key={hunt.id} className="flex items-center justify-between bg-slate-900/50 p-3 rounded border border-slate-700">
                  <div className="flex-1">
                    <button
                      onClick={() => loadHuntQuery(hunt)}
                      className="text-white font-medium hover:text-primary-400 transition text-left"
                    >
                      {hunt.name}
                    </button>
                    <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                      <span>{hunt.huntType}</span>
                      {hunt.lastRunAt && <span>Last run: {new Date(hunt.lastRunAt).toLocaleString()}</span>}
                      {hunt.lastResultCount !== null && <span>{hunt.lastResultCount} results</span>}
                      {hunt.tags && hunt.tags.split(',').map(t => (
                        <span key={t} className="px-1.5 py-0.5 bg-slate-700 rounded text-slate-400">{t.trim()}</span>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => executeHunt(hunt.id)}
                      className="p-2 text-green-400 hover:bg-green-500/10 rounded transition"
                      title="Execute Hunt"
                    >
                      <Play className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => deleteHunt(hunt.id)}
                      className="p-2 text-red-400 hover:bg-red-500/10 rounded transition"
                      title="Delete Hunt"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Search Results */}
      {searchResults.length > 0 && (
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg overflow-hidden">
          <div className="p-4 border-b border-slate-700 flex items-center justify-between">
            <h3 className="text-white font-medium flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-primary-400" />
              Results ({totalResults.toLocaleString()})
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-xs text-slate-400 uppercase tracking-wider border-b border-slate-700">
                  <th className="text-left p-3">Timestamp</th>
                  <th className="text-left p-3">Severity</th>
                  <th className="text-left p-3">Type</th>
                  <th className="text-left p-3">Source IP</th>
                  <th className="text-left p-3">Dest IP</th>
                  <th className="text-left p-3">Sensor</th>
                  <th className="text-left p-3">Description</th>
                  <th className="text-left p-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {searchResults.map((r, i) => (
                  <tr key={r.id || i} className="hover:bg-slate-800/50 transition">
                    <td className="p-3 text-sm text-slate-300 whitespace-nowrap">
                      {r.timestamp ? new Date(r.timestamp).toLocaleString() : '-'}
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${severityColor(r.severity)}`}>
                        {r.severity}
                      </span>
                    </td>
                    <td className="p-3 text-sm text-slate-300 font-mono">{r.threatType}</td>
                    <td className="p-3 text-sm text-slate-300 font-mono">{r.srcIp || '-'}</td>
                    <td className="p-3 text-sm text-slate-300 font-mono">{r.dstIp || '-'}</td>
                    <td className="p-3 text-sm text-slate-400">{r.sensorId}</td>
                    <td className="p-3 text-sm text-slate-400 max-w-xs truncate">{r.description}</td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded text-xs bg-slate-700 text-slate-300">{r.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Save Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-6 w-96">
            <h3 className="text-white font-medium mb-4">Save Hunt</h3>
            <input
              type="text"
              value={saveName}
              onChange={e => setSaveName(e.target.value)}
              placeholder="Hunt name..."
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-white mb-4 focus:border-primary-500 focus:outline-none"
              autoFocus
              onKeyDown={e => e.key === 'Enter' && saveHunt()}
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowSaveModal(false)}
                className="px-4 py-2 text-slate-400 hover:text-white transition"
              >
                Cancel
              </button>
              <button
                onClick={saveHunt}
                className="px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700 transition"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ThreatHunting;
