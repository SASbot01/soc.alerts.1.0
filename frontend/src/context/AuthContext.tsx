import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import api from '../lib/api';

interface User {
    id: string;
    email: string;
    fullName: string;
    role: string;
    companyId: string | null;
}

interface AuthContextType {
    user: User | null;
    permissions: string[];
    login: (accessToken: string, refreshToken: string, user: User, permissions?: string[]) => void;
    logout: () => void;
    isAuthenticated: boolean;
    loading: boolean;
    hasPermission: (permission: string) => boolean;
    hasAnyPermission: (...permissions: string[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [permissions, setPermissions] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const token = localStorage.getItem('token');
        const storedUser = localStorage.getItem('user');
        const storedPermissions = localStorage.getItem('permissions');

        if (token && storedUser) {
            setUser(JSON.parse(storedUser));
            if (storedPermissions) {
                setPermissions(JSON.parse(storedPermissions));
            }
        }
        setLoading(false);
    }, []);

    const login = useCallback((accessToken: string, refreshToken: string, userData: User, perms?: string[]) => {
        localStorage.setItem('token', accessToken);
        localStorage.setItem('refreshToken', refreshToken);
        localStorage.setItem('user', JSON.stringify(userData));
        if (perms) {
            localStorage.setItem('permissions', JSON.stringify(perms));
            setPermissions(perms);
        }
        setUser(userData);
    }, []);

    const logout = useCallback(async () => {
        try {
            const refreshToken = localStorage.getItem('refreshToken');
            await api.post('/auth/logout', refreshToken ? { refreshToken } : {});
        } catch {
            // Ignore logout errors
        } finally {
            localStorage.removeItem('token');
            localStorage.removeItem('refreshToken');
            localStorage.removeItem('user');
            localStorage.removeItem('permissions');
            setUser(null);
            setPermissions([]);
        }
    }, []);

    const hasPermission = useCallback((permission: string) => {
        if (!user) return false;
        if (user.role === 'superadmin') return true;
        return permissions.includes(permission);
    }, [user, permissions]);

    const hasAnyPermission = useCallback((...perms: string[]) => {
        if (!user) return false;
        if (user.role === 'superadmin') return true;
        return perms.some(p => permissions.includes(p));
    }, [user, permissions]);

    const value = useMemo(() => ({
        user,
        permissions,
        login,
        logout,
        isAuthenticated: !!user,
        loading,
        hasPermission,
        hasAnyPermission,
    }), [user, permissions, login, logout, loading, hasPermission, hasAnyPermission]);

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
