import React, { useState, useEffect } from 'react';
import { rbacService } from '../lib/services';
import { ShieldCheck, Plus, Trash2, Edit3, ChevronDown, ChevronRight, CheckCircle, AlertCircle, Lock } from 'lucide-react';
import clsx from 'clsx';

interface Permission {
    id: string;
    resource: string;
    action: string;
    description: string;
}

interface Role {
    id: string;
    name: string;
    displayName: string;
    description: string;
    companyId: string | null;
    system: boolean;
    permissions: Permission[];
}

const RESOURCE_LABELS: Record<string, string> = {
    dashboard: 'Dashboard',
    threats: 'Threats',
    incidents: 'Incidents',
    playbooks: 'Playbooks',
    assets: 'Assets',
    sensors: 'Sensors',
    alerts: 'Alerts',
    audits: 'Audits',
    pentests: 'Pentests',
    vulnerabilities: 'Vulnerabilities',
    certifications: 'Certifications',
    users: 'Users',
    billing: 'Billing',
    mitre: 'MITRE ATT&CK',
    ai_agent: 'AI Agent',
    reports: 'Reports',
    roles: 'Roles',
    settings: 'Settings',
};

const ACTION_COLORS: Record<string, string> = {
    read: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    write: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    delete: 'bg-red-500/10 text-red-400 border-red-500/20',
    execute: 'bg-green-500/10 text-green-400 border-green-500/20',
};

const RoleManagement: React.FC = () => {
    const [roles, setRoles] = useState<Role[]>([]);
    const [permissions, setPermissions] = useState<Permission[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedRole, setExpandedRole] = useState<string | null>(null);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // Create/Edit form
    const [showForm, setShowForm] = useState(false);
    const [editingRole, setEditingRole] = useState<Role | null>(null);
    const [formName, setFormName] = useState('');
    const [formDisplayName, setFormDisplayName] = useState('');
    const [formDescription, setFormDescription] = useState('');
    const [formPermissions, setFormPermissions] = useState<Set<string>>(new Set());
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const [rolesData, permsData] = await Promise.all([
                rbacService.listRoles(),
                rbacService.listPermissions(),
            ]);
            setRoles(rolesData);
            setPermissions(permsData);
        } catch {
            setMessage({ type: 'error', text: 'Failed to load roles and permissions.' });
        } finally {
            setLoading(false);
        }
    };

    const groupedPermissions = permissions.reduce<Record<string, Permission[]>>((acc, perm) => {
        if (!acc[perm.resource]) acc[perm.resource] = [];
        acc[perm.resource].push(perm);
        return acc;
    }, {});

    const openCreateForm = () => {
        setEditingRole(null);
        setFormName('');
        setFormDisplayName('');
        setFormDescription('');
        setFormPermissions(new Set());
        setShowForm(true);
    };

    const openEditForm = (role: Role) => {
        setEditingRole(role);
        setFormName(role.name);
        setFormDisplayName(role.displayName);
        setFormDescription(role.description || '');
        setFormPermissions(new Set(role.permissions.map(p => p.id)));
        setShowForm(true);
    };

    const togglePermission = (permId: string) => {
        setFormPermissions(prev => {
            const next = new Set(prev);
            if (next.has(permId)) next.delete(permId);
            else next.add(permId);
            return next;
        });
    };

    const toggleResourceAll = (resource: string) => {
        const resourcePerms = groupedPermissions[resource] || [];
        const allSelected = resourcePerms.every(p => formPermissions.has(p.id));
        setFormPermissions(prev => {
            const next = new Set(prev);
            resourcePerms.forEach(p => {
                if (allSelected) next.delete(p.id);
                else next.add(p.id);
            });
            return next;
        });
    };

    const handleSave = async () => {
        setSaving(true);
        setMessage(null);
        try {
            if (editingRole) {
                await rbacService.updateRole(editingRole.id, {
                    displayName: formDisplayName,
                    description: formDescription,
                    permissions: Array.from(formPermissions),
                });
                setMessage({ type: 'success', text: `Role "${formDisplayName}" updated.` });
            } else {
                await rbacService.createRole({
                    name: formName,
                    displayName: formDisplayName,
                    description: formDescription,
                    permissions: Array.from(formPermissions),
                });
                setMessage({ type: 'success', text: `Role "${formDisplayName}" created.` });
            }
            setShowForm(false);
            loadData();
        } catch (err: any) {
            setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to save role.' });
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (role: Role) => {
        if (!confirm(`Delete custom role "${role.displayName}"? Users with this role will need a new role assigned.`)) return;
        try {
            await rbacService.deleteRole(role.id);
            setMessage({ type: 'success', text: `Role "${role.displayName}" deleted.` });
            loadData();
        } catch (err: any) {
            setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to delete role.' });
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white mb-1">Roles & Permissions</h1>
                    <p className="text-slate-400">Manage access control roles for your organization</p>
                </div>
                <button
                    onClick={openCreateForm}
                    className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-500 text-white text-sm rounded-[2px] font-medium transition-colors"
                >
                    <Plus className="w-4 h-4" /> Create Custom Role
                </button>
            </div>

            {message && (
                <div className={clsx("p-3 rounded-[2px] flex items-center gap-2 text-sm font-medium",
                    message.type === 'success'
                        ? 'bg-green-500/10 border border-green-500/20 text-green-400'
                        : 'bg-red-500/10 border border-red-500/20 text-red-400'
                )}>
                    {message.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                    {message.text}
                </div>
            )}

            {/* Roles List */}
            <div className="space-y-3">
                {roles.map(role => (
                    <div key={role.id} className="bg-slate-800/50 border border-slate-700/50 rounded-[2px] overflow-hidden">
                        <div
                            className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-800/80 transition-colors"
                            onClick={() => setExpandedRole(expandedRole === role.id ? null : role.id)}
                        >
                            <div className="flex items-center gap-3">
                                {expandedRole === role.id ? (
                                    <ChevronDown className="w-4 h-4 text-slate-400" />
                                ) : (
                                    <ChevronRight className="w-4 h-4 text-slate-400" />
                                )}
                                <ShieldCheck className="w-5 h-5 text-primary-400" />
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="font-semibold text-white">{role.displayName}</span>
                                        {role.system && (
                                            <span className="px-2 py-0.5 text-[10px] uppercase tracking-wider bg-slate-700/50 text-slate-400 rounded-[2px]">
                                                System
                                            </span>
                                        )}
                                    </div>
                                    <span className="text-sm text-slate-400">{role.description}</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="text-xs text-slate-500">
                                    {role.permissions.length} permissions
                                </span>
                                {!role.system && (
                                    <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                                        <button
                                            onClick={() => openEditForm(role)}
                                            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-[2px] transition-colors"
                                        >
                                            <Edit3 className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(role)}
                                            className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-[2px] transition-colors"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                )}
                                {role.system && (
                                    <Lock className="w-4 h-4 text-slate-600" />
                                )}
                            </div>
                        </div>

                        {expandedRole === role.id && (
                            <div className="border-t border-slate-700/50 p-4">
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                                    {role.permissions.map(perm => (
                                        <div key={perm.id} className={clsx(
                                            "px-2.5 py-1.5 rounded-[2px] text-xs border font-medium",
                                            ACTION_COLORS[perm.action] || 'bg-slate-700/50 text-slate-400 border-slate-600/50'
                                        )}>
                                            {RESOURCE_LABELS[perm.resource] || perm.resource}: {perm.action}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Create/Edit Form Modal */}
            {showForm && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-900 border border-slate-700 rounded-[2px] w-full max-w-3xl max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-slate-700/50">
                            <h2 className="text-lg font-semibold text-white">
                                {editingRole ? `Edit Role: ${editingRole.displayName}` : 'Create Custom Role'}
                            </h2>
                        </div>

                        <div className="p-6 space-y-4">
                            {!editingRole && (
                                <div className="space-y-1">
                                    <label className="text-sm font-medium text-slate-300">Role Name (internal)</label>
                                    <input
                                        type="text"
                                        value={formName}
                                        onChange={e => setFormName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))}
                                        className="w-full bg-slate-950/50 border border-slate-700 rounded-[2px] py-2 px-3 text-white text-sm focus:outline-none focus:border-primary-500"
                                        placeholder="custom_role_name"
                                    />
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-sm font-medium text-slate-300">Display Name</label>
                                    <input
                                        type="text"
                                        value={formDisplayName}
                                        onChange={e => setFormDisplayName(e.target.value)}
                                        className="w-full bg-slate-950/50 border border-slate-700 rounded-[2px] py-2 px-3 text-white text-sm focus:outline-none focus:border-primary-500"
                                        placeholder="Custom Role Name"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-sm font-medium text-slate-300">Description</label>
                                    <input
                                        type="text"
                                        value={formDescription}
                                        onChange={e => setFormDescription(e.target.value)}
                                        className="w-full bg-slate-950/50 border border-slate-700 rounded-[2px] py-2 px-3 text-white text-sm focus:outline-none focus:border-primary-500"
                                        placeholder="Brief description of this role"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-sm font-medium text-slate-300">
                                    Permissions ({formPermissions.size} selected)
                                </label>
                                <div className="space-y-2 mt-2">
                                    {Object.entries(groupedPermissions).map(([resource, perms]) => {
                                        const allSelected = perms.every(p => formPermissions.has(p.id));
                                        const someSelected = perms.some(p => formPermissions.has(p.id));
                                        return (
                                            <div key={resource} className="bg-slate-800/30 border border-slate-700/30 rounded-[2px] p-3">
                                                <label className="flex items-center gap-2 cursor-pointer mb-2">
                                                    <input
                                                        type="checkbox"
                                                        checked={allSelected}
                                                        ref={el => { if (el) el.indeterminate = someSelected && !allSelected; }}
                                                        onChange={() => toggleResourceAll(resource)}
                                                        className="rounded-[2px] border-slate-600 text-primary-500 focus:ring-primary-500/50"
                                                    />
                                                    <span className="text-sm font-medium text-white">
                                                        {RESOURCE_LABELS[resource] || resource}
                                                    </span>
                                                </label>
                                                <div className="flex flex-wrap gap-2 ml-6">
                                                    {perms.map(perm => (
                                                        <label
                                                            key={perm.id}
                                                            className={clsx(
                                                                "flex items-center gap-1.5 px-2.5 py-1 rounded-[2px] text-xs border cursor-pointer transition-colors",
                                                                formPermissions.has(perm.id)
                                                                    ? ACTION_COLORS[perm.action] || 'bg-slate-600/50 text-white border-slate-500'
                                                                    : 'bg-slate-900/50 text-slate-500 border-slate-700/50 hover:border-slate-600'
                                                            )}
                                                        >
                                                            <input
                                                                type="checkbox"
                                                                checked={formPermissions.has(perm.id)}
                                                                onChange={() => togglePermission(perm.id)}
                                                                className="hidden"
                                                            />
                                                            {perm.action}
                                                        </label>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        <div className="p-6 border-t border-slate-700/50 flex justify-end gap-3">
                            <button
                                onClick={() => setShowForm(false)}
                                className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={saving || !formDisplayName || (!editingRole && !formName)}
                                className="px-6 py-2 bg-primary-600 hover:bg-primary-500 text-white text-sm rounded-[2px] font-medium transition-colors disabled:opacity-50"
                            >
                                {saving ? 'Saving...' : (editingRole ? 'Update Role' : 'Create Role')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default RoleManagement;
