import React, { useEffect, useState } from 'react';
import { userService } from '../lib/services';
import type { UserProfile } from '../types';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import { Plus, Pencil, Trash2, Users as UsersIcon, CheckCircle, XCircle } from 'lucide-react';

const Users: React.FC = () => {
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);
    const [editUser, setEditUser] = useState<UserProfile | null>(null);
    const [deleteUser, setDeleteUser] = useState<UserProfile | null>(null);

    // Create form
    const [createForm, setCreateForm] = useState({ email: '', fullName: '', role: 'user', password: '' });
    // Edit form
    const [editForm, setEditForm] = useState({ fullName: '', role: '', isActive: true });

    const fetchUsers = async () => {
        try {
            const data = await userService.list();
            setUsers(data);
        } catch (error) {
            console.error('Failed to load users', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchUsers(); }, []);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await userService.create(createForm);
            setShowCreate(false);
            setCreateForm({ email: '', fullName: '', role: 'user', password: '' });
            fetchUsers();
        } catch (error: any) {
            alert(error.response?.data?.message || 'Failed to create user');
        }
    };

    const handleEdit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editUser) return;
        try {
            await userService.update(editUser.id, editForm);
            setEditUser(null);
            fetchUsers();
        } catch (error: any) {
            alert(error.response?.data?.message || 'Failed to update user');
        }
    };

    const handleDelete = async () => {
        if (!deleteUser) return;
        try {
            await userService.delete(deleteUser.id);
            fetchUsers();
        } catch (error: any) {
            alert(error.response?.data?.message || 'Failed to deactivate user');
        }
    };

    const openEdit = (user: UserProfile) => {
        setEditUser(user);
        setEditForm({ fullName: user.fullName, role: user.role, isActive: user.active });
    };

    if (loading) return <div className="p-8 text-slate-400">Loading users...</div>;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white mb-1">User Management</h1>
                    <p className="text-slate-400">Manage users in your organization</p>
                </div>
                <button
                    onClick={() => setShowCreate(true)}
                    className="flex items-center gap-2 px-4 py-2.5 bg-white text-black rounded-[2px] font-medium shadow-lg shadow-primary-500/20 hover:shadow-primary-500/30 active:scale-[0.98] transition-all"
                >
                    <Plus className="w-4 h-4" /> Add User
                </button>
            </div>

            {/* Users Table */}
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-[2px] overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-slate-700/50">
                                <th className="text-left px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Name</th>
                                <th className="text-left px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Email</th>
                                <th className="text-left px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Role</th>
                                <th className="text-left px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Status</th>
                                <th className="text-left px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Created</th>
                                <th className="text-right px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700/30">
                            {users.map((user) => (
                                <tr key={user.id} className="hover:bg-slate-800/30 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-primary-600/20 flex items-center justify-center text-primary-400 font-bold text-sm">
                                                {user.fullName?.charAt(0) || 'U'}
                                            </div>
                                            <span className="text-sm font-medium text-white">{user.fullName}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-slate-300 font-mono">{user.email}</td>
                                    <td className="px-6 py-4">
                                        <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${
                                            user.role === 'admin'
                                                ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                                                : 'bg-slate-500/10 text-slate-400 border border-slate-500/20'
                                        }`}>
                                            {user.role}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        {user.active ? (
                                            <span className="flex items-center gap-1.5 text-xs font-medium text-green-400">
                                                <CheckCircle className="w-3.5 h-3.5" /> Active
                                            </span>
                                        ) : (
                                            <span className="flex items-center gap-1.5 text-xs font-medium text-red-400">
                                                <XCircle className="w-3.5 h-3.5" /> Inactive
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-slate-400">
                                        {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '-'}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <button
                                                onClick={() => openEdit(user)}
                                                className="p-2 text-slate-400 hover:text-primary-400 hover:bg-slate-700/50 rounded-[2px] transition-colors"
                                            >
                                                <Pencil className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => setDeleteUser(user)}
                                                className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-[2px] transition-colors"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {users.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                                        <UsersIcon className="w-12 h-12 mx-auto mb-3 opacity-30" />
                                        No users found
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Create Modal */}
            <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Create User">
                <form onSubmit={handleCreate} className="space-y-4">
                    <div className="space-y-1">
                        <label className="text-sm font-medium text-slate-300">Email</label>
                        <input
                            type="email"
                            value={createForm.email}
                            onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                            className="w-full bg-slate-950/50 border border-slate-700 rounded-[2px] py-2.5 px-4 text-white focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500/50 transition-all"
                            required
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-sm font-medium text-slate-300">Full Name</label>
                        <input
                            type="text"
                            value={createForm.fullName}
                            onChange={(e) => setCreateForm({ ...createForm, fullName: e.target.value })}
                            className="w-full bg-slate-950/50 border border-slate-700 rounded-[2px] py-2.5 px-4 text-white focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500/50 transition-all"
                            required
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-sm font-medium text-slate-300">Role</label>
                        <select
                            value={createForm.role}
                            onChange={(e) => setCreateForm({ ...createForm, role: e.target.value })}
                            className="w-full bg-slate-950/50 border border-slate-700 rounded-[2px] py-2.5 px-4 text-white focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500/50 transition-all"
                        >
                            <option value="user">User</option>
                            <option value="admin">Admin</option>
                        </select>
                    </div>
                    <div className="space-y-1">
                        <label className="text-sm font-medium text-slate-300">Password</label>
                        <input
                            type="password"
                            value={createForm.password}
                            onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                            className="w-full bg-slate-950/50 border border-slate-700 rounded-[2px] py-2.5 px-4 text-white focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500/50 transition-all"
                            required
                        />
                    </div>
                    <div className="flex justify-end gap-3 pt-2">
                        <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-[2px] text-sm font-medium transition-colors">
                            Cancel
                        </button>
                        <button type="submit" className="px-4 py-2 bg-white hover:bg-[#E0E0E0] text-black rounded-[2px] text-sm font-medium transition-colors">
                            Create User
                        </button>
                    </div>
                </form>
            </Modal>

            {/* Edit Modal */}
            <Modal isOpen={!!editUser} onClose={() => setEditUser(null)} title="Edit User">
                <form onSubmit={handleEdit} className="space-y-4">
                    <div className="space-y-1">
                        <label className="text-sm font-medium text-slate-300">Full Name</label>
                        <input
                            type="text"
                            value={editForm.fullName}
                            onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
                            className="w-full bg-slate-950/50 border border-slate-700 rounded-[2px] py-2.5 px-4 text-white focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500/50 transition-all"
                            required
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-sm font-medium text-slate-300">Role</label>
                        <select
                            value={editForm.role}
                            onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                            className="w-full bg-slate-950/50 border border-slate-700 rounded-[2px] py-2.5 px-4 text-white focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500/50 transition-all"
                        >
                            <option value="user">User</option>
                            <option value="admin">Admin</option>
                        </select>
                    </div>
                    <div className="flex items-center gap-3">
                        <label className="text-sm font-medium text-slate-300">Active</label>
                        <button
                            type="button"
                            onClick={() => setEditForm({ ...editForm, isActive: !editForm.isActive })}
                            className={`relative w-11 h-6 rounded-full transition-colors ${editForm.isActive ? 'bg-green-500' : 'bg-slate-600'}`}
                        >
                            <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${editForm.isActive ? 'left-[22px]' : 'left-0.5'}`} />
                        </button>
                    </div>
                    <div className="flex justify-end gap-3 pt-2">
                        <button type="button" onClick={() => setEditUser(null)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-[2px] text-sm font-medium transition-colors">
                            Cancel
                        </button>
                        <button type="submit" className="px-4 py-2 bg-white hover:bg-[#E0E0E0] text-black rounded-[2px] text-sm font-medium transition-colors">
                            Save Changes
                        </button>
                    </div>
                </form>
            </Modal>

            {/* Delete Confirm */}
            <ConfirmDialog
                isOpen={!!deleteUser}
                onClose={() => setDeleteUser(null)}
                onConfirm={handleDelete}
                title="Deactivate User"
                message={`Are you sure you want to deactivate ${deleteUser?.fullName}? They will no longer be able to log in.`}
                confirmLabel="Deactivate"
                confirmColor="bg-red-600 hover:bg-red-500"
            />
        </div>
    );
};

export default Users;
