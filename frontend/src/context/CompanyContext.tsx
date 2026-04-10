import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import api from '../lib/api';
import { useAuth } from './AuthContext';

// ---------------------------------------------------------------------------
// Plan feature definitions
// ---------------------------------------------------------------------------

const PLAN_FEATURES: Record<string, string[]> = {
    starter: [
        'threats',
        'incidents',
        'assets',
        'alerts',
        'infrastructure',
    ],
    professional: [
        'threats',
        'incidents',
        'assets',
        'alerts',
        'infrastructure',
        'vulnerabilities',
        'audits',
        'playbooks',
        'ai_agent',
        'sensors',
        'logs',
        'certifications',
    ],
    enterprise: [
        'threats',
        'incidents',
        'assets',
        'alerts',
        'infrastructure',
        'vulnerabilities',
        'audits',
        'playbooks',
        'ai_agent',
        'sensors',
        'logs',
        'certifications',
        'hunting',
        'sigma',
        'ueba',
        'forensics',
        'cloud_security',
        'identity',
        'network',
        'deception',
        'attack_surface',
        'compliance',
        'cep',
        'vuln_scanner',
    ],
};

// All known feature keys (enterprise is the superset)
const ALL_FEATURES = PLAN_FEATURES.enterprise;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type FeatureFlags = Record<string, boolean>;

interface CompanyContextType {
    companyName: string | null;
    companyDomain: string | null;
    plan: string | null;
    isSuperAdmin: boolean;
    features: FeatureFlags;
    loading: boolean;
    error: string | null;
    reload: () => void;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const CompanyContext = createContext<CompanyContextType | undefined>(undefined);

// ---------------------------------------------------------------------------
// Helper — build feature flags from a plan string
// ---------------------------------------------------------------------------

function buildFeatures(plan: string | null, isSuperAdmin: boolean): FeatureFlags {
    if (isSuperAdmin) {
        return ALL_FEATURES.reduce<FeatureFlags>((acc, f) => {
            acc[f] = true;
            return acc;
        }, {});
    }

    const allowed = PLAN_FEATURES[plan ?? 'starter'] ?? PLAN_FEATURES.starter;

    return ALL_FEATURES.reduce<FeatureFlags>((acc, f) => {
        acc[f] = allowed.includes(f);
        return acc;
    }, {});
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export const CompanyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user, isAuthenticated } = useAuth();

    const [companyName, setCompanyName] = useState<string | null>(null);
    const [companyDomain, setCompanyDomain] = useState<string | null>(null);
    const [plan, setPlan] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [reloadKey, setReloadKey] = useState(0);

    const isSuperAdmin = user?.role === 'superadmin';

    useEffect(() => {
        if (!isAuthenticated) {
            setCompanyName(null);
            setCompanyDomain(null);
            setPlan(null);
            setLoading(false);
            setError(null);
            return;
        }

        let cancelled = false;

        const fetchCompany = async () => {
            setLoading(true);
            setError(null);

            try {
                const { data } = await api.get('/dashboard/overview');
                if (cancelled) return;

                setCompanyName(data.company?.name ?? null);
                setCompanyDomain(data.company?.domain ?? null);
                setPlan(data.company?.plan ?? 'starter');
            } catch (err: any) {
                if (cancelled) return;
                setError(err?.response?.data?.message ?? 'Failed to load company info');
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        fetchCompany();

        return () => {
            cancelled = true;
        };
    }, [isAuthenticated, reloadKey]);

    const reload = () => setReloadKey((k) => k + 1);

    const features = useMemo(
        () => buildFeatures(plan, isSuperAdmin),
        [plan, isSuperAdmin],
    );

    const value = useMemo<CompanyContextType>(() => ({
        companyName,
        companyDomain,
        plan,
        isSuperAdmin,
        features,
        loading,
        error,
        reload,
    }), [companyName, companyDomain, plan, isSuperAdmin, features, loading, error]);

    return (
        <CompanyContext.Provider value={value}>
            {children}
        </CompanyContext.Provider>
    );
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export const useCompany = () => {
    const context = useContext(CompanyContext);
    if (context === undefined) {
        throw new Error('useCompany must be used within a CompanyProvider');
    }
    return context;
};
