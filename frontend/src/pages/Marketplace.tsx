import React, { useEffect, useState } from 'react';
import { Download, Star, Package, CheckCircle, ShoppingBag, Filter } from 'lucide-react';
import api from '../lib/api';

interface MarketplaceItem {
  id: string;
  itemType: string;
  title: string;
  description: string;
  author: string;
  version: string;
  tags: string | null;
  category: string | null;
  downloads: number;
  rating: number;
  ratingCount: number;
  isVerified: boolean;
  createdAt: string;
}

interface Installation {
  id: string;
  itemId: string;
  installedVersion: string;
  installedAt: string;
  isActive: boolean;
}

const marketplaceService = {
  list: (type?: string, category?: string) => {
    const params = new URLSearchParams();
    if (type) params.set('type', type);
    if (category) params.set('category', category);
    return api.get(`/marketplace?${params}`).then(r => r.data);
  },
  install: (id: string) => api.post(`/marketplace/${id}/install`).then(r => r.data),
  uninstall: (id: string) => api.post(`/marketplace/${id}/uninstall`).then(r => r.data),
  rate: (id: string, rating: number) => api.post(`/marketplace/${id}/rate`, { rating }).then(r => r.data),
  installed: () => api.get('/marketplace/installed').then(r => r.data),
};

const typeLabels: Record<string, string> = {
  detection_rule: 'Detection Rule',
  playbook_template: 'Playbook',
  correlation_rule: 'Correlation',
  integration_connector: 'Integration',
};

const typeColors: Record<string, string> = {
  detection_rule: 'text-blue-400 bg-blue-500/10',
  playbook_template: 'text-purple-400 bg-purple-500/10',
  correlation_rule: 'text-amber-400 bg-amber-500/10',
  integration_connector: 'text-green-400 bg-green-500/10',
};

const Marketplace: React.FC = () => {
  const [items, setItems] = useState<MarketplaceItem[]>([]);
  const [installations, setInstallations] = useState<Installation[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('');
  const [installing, setInstalling] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [filterType]);

  const loadData = async () => {
    try {
      const [itemsData, installData] = await Promise.all([
        marketplaceService.list(filterType || undefined),
        marketplaceService.installed(),
      ]);
      setItems(itemsData);
      setInstallations(installData);
    } catch (err) {
      console.error('Failed to load marketplace:', err);
    } finally {
      setLoading(false);
    }
  };

  const isInstalled = (itemId: string) =>
    installations.some(i => i.itemId === itemId && i.isActive);

  const handleInstall = async (itemId: string) => {
    setInstalling(itemId);
    try {
      await marketplaceService.install(itemId);
      loadData();
    } catch (err) {
      console.error('Install failed:', err);
    } finally {
      setInstalling(null);
    }
  };

  const handleUninstall = async (itemId: string) => {
    try {
      await marketplaceService.uninstall(itemId);
      loadData();
    } catch (err) {
      console.error('Uninstall failed:', err);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-slate-400">Loading marketplace...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <ShoppingBag className="w-7 h-7 text-primary-400" />
            Marketplace
          </h1>
          <p className="text-slate-400 text-sm mt-1">Community detection rules, playbooks, and integrations</p>
        </div>
        <div className="text-sm text-slate-400">
          {installations.filter(i => i.isActive).length} installed
        </div>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2">
        <Filter className="w-4 h-4 text-slate-400" />
        {['', 'detection_rule', 'playbook_template', 'correlation_rule', 'integration_connector'].map(type => (
          <button
            key={type}
            onClick={() => setFilterType(type)}
            className={`px-3 py-1.5 rounded text-sm transition ${filterType === type ? 'bg-primary-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
          >
            {type ? typeLabels[type] : 'All'}
          </button>
        ))}
      </div>

      {/* Items Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map(item => (
          <div key={item.id} className="bg-slate-800/50 border border-slate-700 rounded-lg p-5 hover:border-slate-600 transition">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="text-white font-medium">{item.title}</h3>
                <span className={`inline-block mt-1 px-2 py-0.5 rounded text-xs ${typeColors[item.itemType] || 'text-slate-400 bg-slate-700'}`}>
                  {typeLabels[item.itemType] || item.itemType}
                </span>
              </div>
              {item.isVerified && (
                <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
              )}
            </div>

            <p className="text-slate-400 text-sm mb-3 line-clamp-2">{item.description}</p>

            <div className="flex items-center gap-3 text-xs text-slate-500 mb-4">
              <span className="flex items-center gap-1">
                <Download className="w-3 h-3" />{item.downloads}
              </span>
              {item.ratingCount > 0 && (
                <span className="flex items-center gap-1">
                  <Star className="w-3 h-3 text-amber-400" />{item.rating.toFixed(1)}
                </span>
              )}
              <span>v{item.version}</span>
              {item.author && <span>by {item.author}</span>}
            </div>

            {item.tags && (
              <div className="flex flex-wrap gap-1 mb-3">
                {item.tags.split(',').slice(0, 3).map(t => (
                  <span key={t} className="text-xs px-1.5 py-0.5 bg-slate-700 rounded text-slate-400">{t.trim()}</span>
                ))}
              </div>
            )}

            <div>
              {isInstalled(item.id) ? (
                <button
                  onClick={() => handleUninstall(item.id)}
                  className="w-full px-4 py-2 bg-slate-700 text-slate-300 rounded text-sm hover:bg-red-500/20 hover:text-red-400 transition"
                >
                  Uninstall
                </button>
              ) : (
                <button
                  onClick={() => handleInstall(item.id)}
                  disabled={installing === item.id}
                  className="w-full px-4 py-2 bg-primary-600 text-white rounded text-sm hover:bg-primary-700 disabled:opacity-50 transition"
                >
                  {installing === item.id ? 'Installing...' : 'Install'}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {items.length === 0 && (
        <div className="text-center py-12 text-slate-500">
          <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No marketplace items available yet.</p>
        </div>
      )}
    </div>
  );
};

export default Marketplace;
