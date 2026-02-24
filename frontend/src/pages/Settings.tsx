import React, { useState, useEffect } from 'react';
import api from '../lib/api';
import { apiKeyService, ssoService } from '../lib/services';
import { Lock, CheckCircle, AlertCircle, Shield, ShieldOff, Key, Plus, RotateCw, Trash2, Copy, EyeOff, Globe } from 'lucide-react';
import MfaSetup from '../components/MfaSetup';
import { useAuth } from '../context/AuthContext';
import clsx from 'clsx';

interface ApiKeyItem {
    id: string;
    name: string;
    keyPrefix: string;
    scopes: string;
    active: boolean;
    lastUsedAt: string | null;
    createdAt: string;
}

const Settings: React.FC = () => {
    const { hasPermission } = useAuth();
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // MFA state
    const [mfaEnabled, setMfaEnabled] = useState(false);
    const [showMfaSetup, setShowMfaSetup] = useState(false);
    const [mfaLoading, setMfaLoading] = useState(true);

    // API Keys state
    const [apiKeys, setApiKeys] = useState<ApiKeyItem[]>([]);
    const [apiKeysLoading, setApiKeysLoading] = useState(true);
    const [newKeyName, setNewKeyName] = useState('');
    const [showCreateKey, setShowCreateKey] = useState(false);
    const [revealedKey, setRevealedKey] = useState<string | null>(null);
    const [copiedKey, setCopiedKey] = useState(false);

    // SSO state
    const [ssoConfig, setSsoConfig] = useState<{ provider: string; clientId: string; clientSecret: string; issuerUrl: string; autoProvisionUsers: boolean; defaultRole: string; allowedDomains: string; isActive: boolean } | null>(null);
    const [ssoForm, setSsoForm] = useState({ provider: 'okta', clientId: '', clientSecret: '', issuerUrl: '', autoProvisionUsers: true, defaultRole: 'analyst', allowedDomains: '' });
    const [ssoLoading, setSsoLoading] = useState(true);
    const [ssoTestResult, setSsoTestResult] = useState<{ success: boolean; error?: string } | null>(null);

    useEffect(() => {
        loadMfaStatus();
        if (hasPermission('settings:read')) {
            loadApiKeys();
            loadSsoConfig();
        }
    }, []);

    const loadMfaStatus = async () => {
        try {
            const res = await api.get('/mfa/status');
            setMfaEnabled(res.data.mfaEnabled);
        } catch {
            // ignore
        } finally {
            setMfaLoading(false);
        }
    };

    const loadApiKeys = async () => {
        try {
            const data = await apiKeyService.list();
            setApiKeys(data);
        } catch {
            // ignore
        } finally {
            setApiKeysLoading(false);
        }
    };

    const handleDisableMfa = async () => {
        if (!confirm('Are you sure you want to disable two-factor authentication?')) return;
        try {
            await api.post('/mfa/disable');
            setMfaEnabled(false);
            setMessage({ type: 'success', text: 'Two-factor authentication disabled.' });
        } catch (err: any) {
            setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to disable MFA.' });
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setMessage(null);

        if (newPassword !== confirmPassword) {
            setMessage({ type: 'error', text: 'New passwords do not match.' });
            return;
        }

        if (newPassword.length < 4) {
            setMessage({ type: 'error', text: 'New password must be at least 4 characters.' });
            return;
        }

        setLoading(true);
        try {
            await api.post('/account/change-password', {
                currentPassword,
                newPassword,
            });
            setMessage({ type: 'success', text: 'Password changed successfully.' });
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
        } catch (err: any) {
            setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to change password.' });
        } finally {
            setLoading(false);
        }
    };

    const handleCreateKey = async () => {
        if (!newKeyName.trim()) return;
        try {
            const result = await apiKeyService.create({ name: newKeyName.trim() });
            setRevealedKey(result.rawKey);
            setNewKeyName('');
            setShowCreateKey(false);
            loadApiKeys();
            setMessage({ type: 'success', text: 'API key created. Copy it now — it won\'t be shown again.' });
        } catch (err: any) {
            setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to create API key.' });
        }
    };

    const handleRevokeKey = async (id: string) => {
        if (!confirm('Revoke this API key? Sensors using it will stop authenticating.')) return;
        try {
            await apiKeyService.revoke(id);
            loadApiKeys();
            setMessage({ type: 'success', text: 'API key revoked.' });
        } catch (err: any) {
            setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to revoke key.' });
        }
    };

    const handleRotateKey = async (id: string) => {
        if (!confirm('Rotate this API key? The old key will be revoked and a new one created.')) return;
        try {
            const result = await apiKeyService.rotate(id);
            setRevealedKey(result.rawKey);
            loadApiKeys();
            setMessage({ type: 'success', text: 'API key rotated. Copy the new key now.' });
        } catch (err: any) {
            setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to rotate key.' });
        }
    };

    const handleDeleteKey = async (id: string) => {
        if (!confirm('Permanently delete this API key?')) return;
        try {
            await apiKeyService.delete(id);
            loadApiKeys();
            setMessage({ type: 'success', text: 'API key deleted.' });
        } catch (err: any) {
            setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to delete key.' });
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        setCopiedKey(true);
        setTimeout(() => setCopiedKey(false), 2000);
    };

    const loadSsoConfig = async () => {
        try {
            const data = await ssoService.getConfig();
            if (data && data.id) {
                setSsoConfig(data);
                setSsoForm({
                    provider: data.provider || 'okta',
                    clientId: data.clientId || '',
                    clientSecret: '',
                    issuerUrl: data.issuerUrl || '',
                    autoProvisionUsers: data.autoProvisionUsers ?? true,
                    defaultRole: data.defaultRole || 'analyst',
                    allowedDomains: data.allowedDomains || '',
                });
            }
        } catch { /* ignore */ } finally {
            setSsoLoading(false);
        }
    };

    const handleSaveSso = async () => {
        try {
            const result = await ssoService.saveConfig(ssoForm);
            setSsoConfig(result);
            setMessage({ type: 'success', text: 'SSO configuration saved.' });
        } catch (err: any) {
            setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to save SSO config.' });
        }
    };

    const handleToggleSso = async () => {
        if (!ssoConfig) return;
        try {
            const result = await ssoService.toggleActive(!ssoConfig.isActive);
            setSsoConfig(result);
            setMessage({ type: 'success', text: result.isActive ? 'SSO enabled.' : 'SSO disabled.' });
        } catch (err: any) {
            setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to toggle SSO.' });
        }
    };

    const handleTestSso = async () => {
        setSsoTestResult(null);
        try {
            const result = await ssoService.testConnection(ssoForm.issuerUrl);
            setSsoTestResult(result);
        } catch {
            setSsoTestResult({ success: false, error: 'Connection failed' });
        }
    };

    const handleDeleteSso = async () => {
        if (!confirm('Delete SSO configuration? Users will need to use password login.')) return;
        try {
            await ssoService.deleteConfig();
            setSsoConfig(null);
            setSsoForm({ provider: 'okta', clientId: '', clientSecret: '', issuerUrl: '', autoProvisionUsers: true, defaultRole: 'analyst', allowedDomains: '' });
            setMessage({ type: 'success', text: 'SSO configuration deleted.' });
        } catch (err: any) {
            setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to delete SSO config.' });
        }
    };

    return (
        <div className="max-w-xl mx-auto space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-white mb-1">Settings</h1>
                <p className="text-slate-400">Manage your account settings</p>
            </div>

            {message && (
                <div className={`p-3 rounded-[2px] flex items-center gap-2 text-sm font-medium ${
                    message.type === 'success'
                        ? 'bg-green-500/10 border border-green-500/20 text-green-400'
                        : 'bg-red-500/10 border border-red-500/20 text-red-400'
                }`}>
                    {message.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                    {message.text}
                </div>
            )}

            {/* Revealed Key Banner */}
            {revealedKey && (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-[2px] p-4 space-y-2">
                    <p className="text-amber-400 text-sm font-medium">Copy your API key now. It won't be shown again.</p>
                    <div className="flex items-center gap-2">
                        <code className="flex-1 bg-slate-950/50 border border-slate-700 rounded-[2px] py-2 px-3 text-white text-sm font-mono break-all">
                            {revealedKey}
                        </code>
                        <button
                            onClick={() => copyToClipboard(revealedKey)}
                            className="px-3 py-2 bg-primary-600 hover:bg-primary-500 text-white rounded-[2px] text-sm flex items-center gap-1"
                        >
                            <Copy className="w-4 h-4" /> {copiedKey ? 'Copied!' : 'Copy'}
                        </button>
                    </div>
                    <button
                        onClick={() => setRevealedKey(null)}
                        className="text-xs text-slate-500 hover:text-slate-300"
                    >
                        Dismiss
                    </button>
                </div>
            )}

            {/* MFA Section */}
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-[2px] p-6">
                <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <Shield className="w-5 h-5 text-primary-400" />
                    Two-Factor Authentication
                </h2>

                {mfaLoading ? (
                    <p className="text-slate-400 text-sm">Loading...</p>
                ) : showMfaSetup ? (
                    <MfaSetup
                        onComplete={() => {
                            setShowMfaSetup(false);
                            setMfaEnabled(true);
                            setMessage({ type: 'success', text: 'Two-factor authentication enabled successfully.' });
                        }}
                        onCancel={() => setShowMfaSetup(false)}
                    />
                ) : mfaEnabled ? (
                    <div className="space-y-3">
                        <div className="flex items-center gap-2 text-emerald-400 text-sm">
                            <CheckCircle className="w-4 h-4" />
                            <span>Two-factor authentication is enabled</span>
                        </div>
                        <button
                            onClick={handleDisableMfa}
                            className="flex items-center gap-2 px-4 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-[2px] transition-colors"
                        >
                            <ShieldOff className="w-4 h-4" />
                            Disable MFA
                        </button>
                    </div>
                ) : (
                    <div className="space-y-3">
                        <p className="text-slate-400 text-sm">
                            Add an extra layer of security to your account by enabling two-factor authentication.
                        </p>
                        <button
                            onClick={() => setShowMfaSetup(true)}
                            className="px-4 py-2 bg-primary-600 hover:bg-primary-500 text-white text-sm rounded-[2px] font-medium transition-colors"
                        >
                            Enable MFA
                        </button>
                    </div>
                )}
            </div>

            {/* API Keys Section */}
            {hasPermission('settings:read') && (
                <div className="bg-slate-800/50 border border-slate-700/50 rounded-[2px] p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                            <Key className="w-5 h-5 text-primary-400" />
                            API Keys
                        </h2>
                        {hasPermission('settings:write') && (
                            <button
                                onClick={() => setShowCreateKey(!showCreateKey)}
                                className="flex items-center gap-1 px-3 py-1.5 bg-primary-600 hover:bg-primary-500 text-white text-xs rounded-[2px] font-medium transition-colors"
                            >
                                <Plus className="w-3 h-3" /> New Key
                            </button>
                        )}
                    </div>

                    {showCreateKey && (
                        <div className="mb-4 flex gap-2">
                            <input
                                type="text"
                                value={newKeyName}
                                onChange={e => setNewKeyName(e.target.value)}
                                className="flex-1 bg-slate-950/50 border border-slate-700 rounded-[2px] py-2 px-3 text-white text-sm focus:outline-none focus:border-primary-500"
                                placeholder="Key name (e.g. Production Sensor)"
                                onKeyDown={e => e.key === 'Enter' && handleCreateKey()}
                            />
                            <button
                                onClick={handleCreateKey}
                                disabled={!newKeyName.trim()}
                                className="px-4 py-2 bg-primary-600 hover:bg-primary-500 text-white text-sm rounded-[2px] font-medium disabled:opacity-50"
                            >
                                Create
                            </button>
                        </div>
                    )}

                    {apiKeysLoading ? (
                        <p className="text-slate-400 text-sm">Loading...</p>
                    ) : apiKeys.length === 0 ? (
                        <p className="text-slate-500 text-sm">No API keys created yet.</p>
                    ) : (
                        <div className="space-y-2">
                            {apiKeys.map(key => (
                                <div key={key.id} className="flex items-center justify-between bg-slate-900/50 border border-slate-700/30 rounded-[2px] px-3 py-2.5">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-medium text-white truncate">{key.name}</span>
                                            <span className={clsx(
                                                "px-1.5 py-0.5 text-[10px] uppercase tracking-wider rounded-[2px]",
                                                key.active
                                                    ? "bg-green-500/10 text-green-400"
                                                    : "bg-red-500/10 text-red-400"
                                            )}>
                                                {key.active ? 'Active' : 'Revoked'}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-3 mt-0.5">
                                            <code className="text-xs text-slate-500 font-mono">{key.keyPrefix}...</code>
                                            {key.lastUsedAt && (
                                                <span className="text-xs text-slate-600">
                                                    Last used {new Date(key.lastUsedAt).toLocaleDateString()}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    {hasPermission('settings:write') && key.active && (
                                        <div className="flex items-center gap-1 ml-2">
                                            <button
                                                onClick={() => handleRotateKey(key.id)}
                                                title="Rotate"
                                                className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 rounded-[2px] transition-colors"
                                            >
                                                <RotateCw className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                                onClick={() => handleRevokeKey(key.id)}
                                                title="Revoke"
                                                className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-[2px] transition-colors"
                                            >
                                                <EyeOff className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                                onClick={() => handleDeleteKey(key.id)}
                                                title="Delete"
                                                className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-[2px] transition-colors"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    <p className="text-xs text-slate-600 mt-3">
                        API keys authenticate sensor uploads. The key hash is stored — raw keys are shown only at creation.
                    </p>
                </div>
            )}

            {/* SSO Configuration Section */}
            {hasPermission('settings:write') && (
                <div className="bg-slate-800/50 border border-slate-700/50 rounded-[2px] p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                            <Globe className="w-5 h-5 text-primary-400" />
                            Single Sign-On (SSO)
                        </h2>
                        {ssoConfig && (
                            <button
                                onClick={handleToggleSso}
                                className={clsx(
                                    "px-3 py-1 text-xs font-medium rounded-[2px] transition-colors",
                                    ssoConfig.isActive
                                        ? "bg-green-500/10 text-green-400 hover:bg-green-500/20"
                                        : "bg-slate-700 text-slate-400 hover:bg-slate-600"
                                )}
                            >
                                {ssoConfig.isActive ? 'Active' : 'Inactive'}
                            </button>
                        )}
                    </div>

                    {ssoLoading ? (
                        <p className="text-slate-400 text-sm">Loading...</p>
                    ) : (
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-sm text-slate-300">Provider</label>
                                    <select
                                        value={ssoForm.provider}
                                        onChange={e => setSsoForm({ ...ssoForm, provider: e.target.value })}
                                        className="w-full bg-slate-950/50 border border-slate-700 rounded-[2px] py-2 px-3 text-white text-sm"
                                    >
                                        <option value="okta">Okta</option>
                                        <option value="azure_ad">Azure AD</option>
                                        <option value="google">Google Workspace</option>
                                        <option value="custom_oidc">Custom OIDC</option>
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-sm text-slate-300">Default Role for New Users</label>
                                    <select
                                        value={ssoForm.defaultRole}
                                        onChange={e => setSsoForm({ ...ssoForm, defaultRole: e.target.value })}
                                        className="w-full bg-slate-950/50 border border-slate-700 rounded-[2px] py-2 px-3 text-white text-sm"
                                    >
                                        <option value="viewer">Viewer</option>
                                        <option value="analyst">Analyst</option>
                                        <option value="soc_manager">SOC Manager</option>
                                        <option value="admin">Admin</option>
                                    </select>
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-sm text-slate-300">Issuer URL</label>
                                <div className="flex gap-2">
                                    <input
                                        type="url"
                                        value={ssoForm.issuerUrl}
                                        onChange={e => setSsoForm({ ...ssoForm, issuerUrl: e.target.value })}
                                        className="flex-1 bg-slate-950/50 border border-slate-700 rounded-[2px] py-2 px-3 text-white text-sm"
                                        placeholder="https://your-org.okta.com"
                                    />
                                    <button
                                        onClick={handleTestSso}
                                        disabled={!ssoForm.issuerUrl}
                                        className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white text-xs rounded-[2px] disabled:opacity-50"
                                    >
                                        Test
                                    </button>
                                </div>
                                {ssoTestResult && (
                                    <p className={clsx("text-xs mt-1", ssoTestResult.success ? "text-green-400" : "text-red-400")}>
                                        {ssoTestResult.success ? 'Connection successful' : `Failed: ${ssoTestResult.error}`}
                                    </p>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-sm text-slate-300">Client ID</label>
                                    <input
                                        type="text"
                                        value={ssoForm.clientId}
                                        onChange={e => setSsoForm({ ...ssoForm, clientId: e.target.value })}
                                        className="w-full bg-slate-950/50 border border-slate-700 rounded-[2px] py-2 px-3 text-white text-sm"
                                        placeholder="0oa1234..."
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-sm text-slate-300">Client Secret</label>
                                    <input
                                        type="password"
                                        value={ssoForm.clientSecret}
                                        onChange={e => setSsoForm({ ...ssoForm, clientSecret: e.target.value })}
                                        className="w-full bg-slate-950/50 border border-slate-700 rounded-[2px] py-2 px-3 text-white text-sm"
                                        placeholder={ssoConfig ? '••••••••' : 'Enter secret'}
                                    />
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-sm text-slate-300">Allowed Email Domains <span className="text-slate-500">(comma-separated, empty = all)</span></label>
                                <input
                                    type="text"
                                    value={ssoForm.allowedDomains}
                                    onChange={e => setSsoForm({ ...ssoForm, allowedDomains: e.target.value })}
                                    className="w-full bg-slate-950/50 border border-slate-700 rounded-[2px] py-2 px-3 text-white text-sm"
                                    placeholder="company.com, subsidiary.com"
                                />
                            </div>

                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={ssoForm.autoProvisionUsers}
                                    onChange={e => setSsoForm({ ...ssoForm, autoProvisionUsers: e.target.checked })}
                                    className="rounded"
                                />
                                <span className="text-sm text-slate-300">Auto-provision new users on first SSO login</span>
                            </label>

                            <div className="flex items-center gap-2 pt-2">
                                <button
                                    onClick={handleSaveSso}
                                    disabled={!ssoForm.issuerUrl || !ssoForm.clientId}
                                    className="px-4 py-2 bg-primary-600 hover:bg-primary-500 text-white text-sm rounded-[2px] font-medium disabled:opacity-50"
                                >
                                    Save Configuration
                                </button>
                                {ssoConfig && (
                                    <button
                                        onClick={handleDeleteSso}
                                        className="px-4 py-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 text-sm rounded-[2px] transition-colors"
                                    >
                                        Delete SSO
                                    </button>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Password Section */}
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-[2px] p-6">
                <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <Lock className="w-5 h-5 text-primary-400" />
                    Change Password
                </h2>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-1">
                        <label className="text-sm font-medium text-slate-300">Current Password</label>
                        <input
                            type="password"
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                            className="w-full bg-slate-950/50 border border-slate-700 rounded-[2px] py-2.5 px-4 text-white focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500/50 transition-all"
                            required
                        />
                    </div>

                    <div className="space-y-1">
                        <label className="text-sm font-medium text-slate-300">New Password</label>
                        <input
                            type="password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            className="w-full bg-slate-950/50 border border-slate-700 rounded-[2px] py-2.5 px-4 text-white focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500/50 transition-all"
                            required
                        />
                    </div>

                    <div className="space-y-1">
                        <label className="text-sm font-medium text-slate-300">Confirm New Password</label>
                        <input
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className="w-full bg-slate-950/50 border border-slate-700 rounded-[2px] py-2.5 px-4 text-white focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500/50 transition-all"
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-white text-black font-semibold py-2.5 rounded-[2px] shadow-lg shadow-primary-500/20 hover:shadow-primary-500/30 active:scale-[0.98] transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                        {loading ? 'Changing Password...' : 'Change Password'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default Settings;
