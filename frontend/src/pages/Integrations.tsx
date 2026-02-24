import React, { useEffect, useState } from 'react';
import { Check, X, ChevronDown, ChevronUp, RefreshCw, Trash2, ToggleLeft, ToggleRight, Zap, Ticket } from 'lucide-react';
import { integrationService } from '../lib/services';
import clsx from 'clsx';

interface AvailableProvider {
    provider: string;
    category: string;
    displayName: string;
    description: string;
    configured: boolean;
    active: boolean;
}

interface IntegrationItem {
    id: string;
    provider: string;
    category: string;
    displayName: string;
    active: boolean;
    autoCreateTickets: boolean;
    minSeverityTicket: number;
    autoPage: boolean;
    minSeverityPage: number;
    lastSyncAt: string | null;
    lastError: string | null;
    createdAt: string;
    configured: boolean;
}

interface IntegrationOverview {
    integrations: IntegrationItem[];
    ticketingCount: number;
    alertingCount: number;
    activeCount: number;
}

const providerLogos: Record<string, string> = {
    jira: 'J',
    servicenow: 'SN',
    pagerduty: 'PD',
    opsgenie: 'OG',
};

const providerColors: Record<string, string> = {
    jira: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    servicenow: 'bg-green-500/20 text-green-400 border-green-500/30',
    pagerduty: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    opsgenie: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
};

const Integrations: React.FC = () => {
    const [overview, setOverview] = useState<IntegrationOverview | null>(null);
    const [providers, setProviders] = useState<AvailableProvider[]>([]);
    const [loading, setLoading] = useState(true);
    const [configuring, setConfiguring] = useState<string | null>(null);
    const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
    const [saving, setSaving] = useState(false);

    // Form state
    const [form, setForm] = useState<Record<string, string>>({});
    const [autoTicket, setAutoTicket] = useState(false);
    const [minSevTicket, setMinSevTicket] = useState(5);
    const [autoPage, setAutoPage] = useState(false);
    const [minSevPage, setMinSevPage] = useState(7);

    const load = async () => {
        try {
            const [ov, prov] = await Promise.all([
                integrationService.getOverview(),
                integrationService.getProviders(),
            ]);
            setOverview(ov);
            setProviders(prov);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const handleConfigure = (provider: string) => {
        setConfiguring(configuring === provider ? null : provider);
        setForm({});
        setTestResult(null);
        setAutoTicket(false);
        setAutoPage(false);
        setMinSevTicket(5);
        setMinSevPage(7);

        // Pre-fill from existing config
        const existing = overview?.integrations.find(i => i.provider === provider);
        if (existing) {
            setAutoTicket(existing.autoCreateTickets);
            setMinSevTicket(existing.minSeverityTicket);
            setAutoPage(existing.autoPage);
            setMinSevPage(existing.minSeverityPage);
        }
    };

    const handleSave = async (provider: string) => {
        setSaving(true);
        try {
            await integrationService.save({
                provider,
                ...form,
                autoCreateTickets: autoTicket,
                minSeverityTicket: minSevTicket,
                autoPage: autoPage,
                minSeverityPage: minSevPage,
            });
            setConfiguring(null);
            await load();
        } catch (err) {
            console.error(err);
        } finally {
            setSaving(false);
        }
    };

    const handleToggle = async (id: string) => {
        try {
            await integrationService.toggle(id);
            await load();
        } catch (err) {
            console.error(err);
        }
    };

    const handleTest = async (id: string) => {
        setTestResult(null);
        try {
            const result = await integrationService.test(id);
            setTestResult(result);
        } catch (err) {
            setTestResult({ success: false, message: 'Test failed' });
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Remove this integration?')) return;
        try {
            await integrationService.delete(id);
            await load();
        } catch (err) {
            console.error(err);
        }
    };

    const renderFormFields = (provider: string) => {
        const field = (key: string, label: string, type = 'text', placeholder = '') => (
            <div key={key}>
                <label className="text-xs text-slate-400 block mb-1">{label}</label>
                <input
                    type={type}
                    value={form[key] || ''}
                    onChange={e => setForm(prev => ({ ...prev, [key]: e.target.value }))}
                    placeholder={placeholder}
                    className="w-full bg-slate-900 border border-slate-700 rounded-[2px] px-3 py-2 text-white text-sm"
                />
            </div>
        );

        switch (provider) {
            case 'jira':
                return (
                    <>
                        {field('baseUrl', 'Jira Base URL', 'url', 'https://your-domain.atlassian.net')}
                        {field('email', 'Email', 'email', 'user@company.com')}
                        {field('apiToken', 'API Token', 'password', 'Your Jira API token')}
                        {field('projectKey', 'Project Key', 'text', 'SEC')}
                        {field('issueType', 'Issue Type', 'text', 'Bug')}
                    </>
                );
            case 'servicenow':
                return (
                    <>
                        {field('instanceUrl', 'Instance URL', 'url', 'https://your-instance.service-now.com')}
                        {field('username', 'Username', 'text', 'admin')}
                        {field('password', 'Password', 'password')}
                        {field('tableName', 'Table Name', 'text', 'incident')}
                    </>
                );
            case 'pagerduty':
                return (
                    <>
                        {field('routingKey', 'Events API v2 Routing Key', 'password', '32-char integration key')}
                    </>
                );
            case 'opsgenie':
                return (
                    <>
                        {field('apiKey', 'API Key', 'password', 'OpsGenie API Key')}
                        {field('teamId', 'Team ID (optional)', 'text', 'Team UUID')}
                    </>
                );
            default:
                return null;
        }
    };

    if (loading) {
        return (
            <div className="space-y-6">
                <h1 className="text-2xl font-bold text-white">Integrations</h1>
                <div className="animate-pulse space-y-4">
                    {[...Array(4)].map((_, i) => (
                        <div key={i} className="h-24 bg-slate-800/50 border border-slate-700/50 rounded-[2px]" />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-white">Integrations</h1>
                {overview && (
                    <div className="flex gap-4 text-sm">
                        <span className="text-slate-400">{overview.activeCount} active</span>
                        <span className="text-blue-400">{overview.ticketingCount} ticketing</span>
                        <span className="text-emerald-400">{overview.alertingCount} alerting</span>
                    </div>
                )}
            </div>

            {/* Ticketing Section */}
            <div>
                <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Ticket className="w-4 h-4" /> Ticketing
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {providers.filter(p => p.category === 'ticketing').map(p => {
                        const existing = overview?.integrations.find(i => i.provider === p.provider);
                        return (
                            <ProviderCard
                                key={p.provider}
                                provider={p}
                                integration={existing}
                                isConfiguring={configuring === p.provider}
                                onConfigure={() => handleConfigure(p.provider)}
                                onToggle={existing ? () => handleToggle(existing.id) : undefined}
                                onTest={existing ? () => handleTest(existing.id) : undefined}
                                onDelete={existing ? () => handleDelete(existing.id) : undefined}
                                testResult={configuring === p.provider ? testResult : null}
                                formContent={configuring === p.provider ? (
                                    <div className="space-y-3 mt-4 pt-4 border-t border-slate-700/50">
                                        {renderFormFields(p.provider)}
                                        <div className="flex items-center gap-2 pt-2">
                                            <input type="checkbox" id={`auto-ticket-${p.provider}`} checked={autoTicket} onChange={e => setAutoTicket(e.target.checked)} className="rounded border-slate-600" />
                                            <label htmlFor={`auto-ticket-${p.provider}`} className="text-sm text-slate-300">Auto-create tickets</label>
                                            {autoTicket && (
                                                <select value={minSevTicket} onChange={e => setMinSevTicket(Number(e.target.value))} className="ml-2 bg-slate-900 border border-slate-700 rounded-[2px] px-2 py-1 text-sm text-white">
                                                    <option value={3}>Sev 3+</option>
                                                    <option value={5}>Sev 5+</option>
                                                    <option value={7}>Sev 7+</option>
                                                </select>
                                            )}
                                        </div>
                                        <div className="flex gap-2 pt-2">
                                            <button onClick={() => handleSave(p.provider)} disabled={saving} className="px-4 py-2 bg-white hover:bg-[#E0E0E0] text-black rounded-[2px] text-sm font-medium transition-colors disabled:opacity-50">
                                                {saving ? 'Saving...' : 'Save'}
                                            </button>
                                            <button onClick={() => setConfiguring(null)} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-[2px] text-sm transition-colors">
                                                Cancel
                                            </button>
                                        </div>
                                    </div>
                                ) : null}
                            />
                        );
                    })}
                </div>
            </div>

            {/* Alerting Section */}
            <div>
                <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Zap className="w-4 h-4" /> Incident Alerting
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {providers.filter(p => p.category === 'alerting').map(p => {
                        const existing = overview?.integrations.find(i => i.provider === p.provider);
                        return (
                            <ProviderCard
                                key={p.provider}
                                provider={p}
                                integration={existing}
                                isConfiguring={configuring === p.provider}
                                onConfigure={() => handleConfigure(p.provider)}
                                onToggle={existing ? () => handleToggle(existing.id) : undefined}
                                onTest={existing ? () => handleTest(existing.id) : undefined}
                                onDelete={existing ? () => handleDelete(existing.id) : undefined}
                                testResult={configuring === p.provider ? testResult : null}
                                formContent={configuring === p.provider ? (
                                    <div className="space-y-3 mt-4 pt-4 border-t border-slate-700/50">
                                        {renderFormFields(p.provider)}
                                        <div className="flex items-center gap-2 pt-2">
                                            <input type="checkbox" id={`auto-page-${p.provider}`} checked={autoPage} onChange={e => setAutoPage(e.target.checked)} className="rounded border-slate-600" />
                                            <label htmlFor={`auto-page-${p.provider}`} className="text-sm text-slate-300">Auto-page on incidents</label>
                                            {autoPage && (
                                                <select value={minSevPage} onChange={e => setMinSevPage(Number(e.target.value))} className="ml-2 bg-slate-900 border border-slate-700 rounded-[2px] px-2 py-1 text-sm text-white">
                                                    <option value={5}>Sev 5+</option>
                                                    <option value={7}>Sev 7+</option>
                                                    <option value={9}>Sev 9+</option>
                                                </select>
                                            )}
                                        </div>
                                        <div className="flex gap-2 pt-2">
                                            <button onClick={() => handleSave(p.provider)} disabled={saving} className="px-4 py-2 bg-white hover:bg-[#E0E0E0] text-black rounded-[2px] text-sm font-medium transition-colors disabled:opacity-50">
                                                {saving ? 'Saving...' : 'Save'}
                                            </button>
                                            <button onClick={() => setConfiguring(null)} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-[2px] text-sm transition-colors">
                                                Cancel
                                            </button>
                                        </div>
                                    </div>
                                ) : null}
                            />
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

const ProviderCard: React.FC<{
    provider: AvailableProvider;
    integration?: IntegrationItem;
    isConfiguring: boolean;
    onConfigure: () => void;
    onToggle?: () => void;
    onTest?: () => void;
    onDelete?: () => void;
    testResult: { success: boolean; message: string } | null;
    formContent: React.ReactNode;
}> = ({ provider, integration, isConfiguring, onConfigure, onToggle, onTest, onDelete, testResult, formContent }) => {
    return (
        <div className={clsx(
            "bg-slate-800/50 border rounded-[2px] p-4 transition-all",
            integration?.active ? "border-primary-500/30" : "border-slate-700/50"
        )}>
            <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                    <div className={clsx("w-10 h-10 rounded-[2px] flex items-center justify-center text-sm font-bold border", providerColors[provider.provider] || "bg-slate-700 text-slate-300 border-slate-600")}>
                        {providerLogos[provider.provider]}
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="text-white font-medium">{provider.displayName}</h3>
                            {integration?.active && (
                                <span className="px-1.5 py-0.5 text-[10px] font-medium bg-green-500/10 text-green-400 rounded">ACTIVE</span>
                            )}
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">{provider.description}</p>
                    </div>
                </div>

                <div className="flex items-center gap-1">
                    {integration && (
                        <>
                            <button onClick={onToggle} className="p-1.5 text-slate-500 hover:text-white transition-colors" title={integration.active ? "Disable" : "Enable"}>
                                {integration.active ? <ToggleRight className="w-5 h-5 text-green-400" /> : <ToggleLeft className="w-5 h-5" />}
                            </button>
                            <button onClick={onTest} className="p-1.5 text-slate-500 hover:text-white transition-colors" title="Test Connection">
                                <RefreshCw className="w-4 h-4" />
                            </button>
                            <button onClick={onDelete} className="p-1.5 text-slate-500 hover:text-red-400 transition-colors" title="Remove">
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </>
                    )}
                    <button onClick={onConfigure} className="p-1.5 text-slate-500 hover:text-white transition-colors">
                        {isConfiguring ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                </div>
            </div>

            {/* Status line */}
            {integration && (
                <div className="mt-2 flex items-center gap-3 text-[11px]">
                    {integration.lastSyncAt && (
                        <span className="text-slate-500">Last sync: {new Date(integration.lastSyncAt).toLocaleString()}</span>
                    )}
                    {integration.lastError && (
                        <span className="text-red-400 truncate max-w-[200px]">{integration.lastError}</span>
                    )}
                    {integration.autoCreateTickets && <span className="text-blue-400">Auto-ticket sev {integration.minSeverityTicket}+</span>}
                    {integration.autoPage && <span className="text-emerald-400">Auto-page sev {integration.minSeverityPage}+</span>}
                </div>
            )}

            {/* Test result */}
            {testResult && (
                <div className={clsx("mt-2 px-3 py-2 rounded-[2px] text-xs flex items-center gap-2",
                    testResult.success ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"
                )}>
                    {testResult.success ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                    {testResult.message}
                </div>
            )}

            {/* Config form */}
            {formContent}
        </div>
    );
};

export default Integrations;
