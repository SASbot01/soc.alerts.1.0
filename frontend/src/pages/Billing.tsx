import React, { useEffect, useState } from 'react';
import { CreditCard, Check, ExternalLink, FileText, AlertTriangle, RefreshCw, X } from 'lucide-react';
import { billingService } from '../lib/services';

interface PlanLimits {
  maxAssets: number;
  maxUsers: number;
  retentionDays: number;
  priceMonthly: number;
}

interface UsageInfo {
  currentAssets: number;
  currentUsers: number;
}

interface InvoiceSummary {
  id: string;
  amountDue: number;
  amountPaid: number;
  currency: string;
  status: string;
  invoiceUrl: string;
  invoicePdf: string;
  periodStart: string;
  periodEnd: string;
  createdAt: string;
}

interface BillingOverview {
  plan: string;
  subscriptionStatus: string;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  limits: PlanLimits;
  usage: UsageInfo;
  recentInvoices: InvoiceSummary[];
}

interface PlanInfo {
  planId: string;
  name: string;
  priceMonthly: number;
  maxAssets: number;
  maxUsers: number;
  retentionDays: number;
  features: string[];
}

const Billing: React.FC = () => {
  const [overview, setOverview] = useState<BillingOverview | null>(null);
  const [plans, setPlans] = useState<PlanInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [ov, pl] = await Promise.all([
        billingService.getOverview(),
        billingService.getPlans(),
      ]);
      setOverview(ov);
      setPlans(pl);
    } catch (err) {
      console.error('Failed to load billing data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckout = async (plan: string) => {
    setActionLoading(plan);
    try {
      const res = await billingService.createCheckout(plan);
      if (res.url) window.location.href = res.url;
    } catch (err) {
      console.error('Checkout failed:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleChangePlan = async (newPlan: string) => {
    setActionLoading(newPlan);
    try {
      await billingService.changePlan(newPlan);
      await loadData();
    } catch (err) {
      console.error('Plan change failed:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancel = async () => {
    if (!confirm('Are you sure you want to cancel your subscription? It will remain active until the end of the current billing period.')) return;
    setActionLoading('cancel');
    try {
      await billingService.cancel();
      await loadData();
    } catch (err) {
      console.error('Cancel failed:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleReactivate = async () => {
    setActionLoading('reactivate');
    try {
      await billingService.reactivate();
      await loadData();
    } catch (err) {
      console.error('Reactivate failed:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const handlePortal = async () => {
    setActionLoading('portal');
    try {
      const res = await billingService.createPortal();
      if (res.url) window.location.href = res.url;
    } catch (err) {
      console.error('Portal failed:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  const getTrialDaysRemaining = () => {
    if (!overview?.trialEndsAt) return null;
    const diff = new Date(overview.trialEndsAt).getTime() - Date.now();
    if (diff <= 0) return null;
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      active: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
      trialing: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      past_due: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
      canceling: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
      canceled: 'bg-red-500/20 text-red-400 border-red-500/30',
      none: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
    };
    return (
      <span className={`px-2 py-0.5 text-xs font-semibold uppercase rounded border ${styles[status] || styles.none}`}>
        {status}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-6 h-6 text-slate-400 animate-spin" />
      </div>
    );
  }

  const trialDays = getTrialDaysRemaining();
  const hasSubscription = overview?.subscriptionStatus && overview.subscriptionStatus !== 'none';
  const isCanceling = overview?.subscriptionStatus === 'canceling';

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <CreditCard className="w-7 h-7 text-primary-400" />
        <h1 className="text-2xl font-bold text-white">Billing & Subscription</h1>
      </div>

      {/* Current Plan Card */}
      {overview && (
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold text-white capitalize">{overview.plan} Plan</h2>
              {getStatusBadge(overview.subscriptionStatus)}
            </div>
            {hasSubscription && (
              <button
                onClick={handlePortal}
                disabled={actionLoading === 'portal'}
                className="px-4 py-2 text-sm bg-slate-700 hover:bg-slate-600 text-white rounded transition-colors"
              >
                Manage Payment Methods
              </button>
            )}
          </div>

          {trialDays && (
            <div className="mb-4 px-3 py-2 bg-blue-500/10 border border-blue-500/20 rounded text-blue-300 text-sm">
              Trial: {trialDays} day{trialDays !== 1 ? 's' : ''} remaining
            </div>
          )}

          {isCanceling && overview.currentPeriodEnd && (
            <div className="mb-4 px-3 py-2 bg-orange-500/10 border border-orange-500/20 rounded text-orange-300 text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Cancels on {formatDate(overview.currentPeriodEnd)}
              <button
                onClick={handleReactivate}
                disabled={actionLoading === 'reactivate'}
                className="ml-auto px-3 py-1 text-xs bg-emerald-600 hover:bg-emerald-500 text-white rounded transition-colors"
              >
                Reactivate
              </button>
            </div>
          )}

          {overview.currentPeriodEnd && !isCanceling && (
            <p className="text-sm text-slate-400 mb-4">
              Current period ends: {formatDate(overview.currentPeriodEnd)}
            </p>
          )}

          {/* Usage bars */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <UsageBar
              label="Assets"
              current={overview.usage.currentAssets}
              max={overview.limits.maxAssets}
            />
            <UsageBar
              label="Users"
              current={overview.usage.currentUsers}
              max={overview.limits.maxUsers >= 999999 ? -1 : overview.limits.maxUsers}
            />
            <div className="bg-slate-900/50 rounded-lg p-4">
              <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Retention</div>
              <div className="text-lg font-semibold text-white">{overview.limits.retentionDays} days</div>
            </div>
          </div>
        </div>
      )}

      {/* Plans Grid */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-4">Available Plans</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {plans.map((plan) => {
            const isCurrent = overview?.plan === plan.planId;
            return (
              <div
                key={plan.planId}
                className={`bg-slate-800/50 border rounded-lg p-6 flex flex-col ${
                  isCurrent ? 'border-primary-500/50 ring-1 ring-primary-500/20' : 'border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-bold text-white">{plan.name}</h3>
                  {isCurrent && (
                    <span className="px-2 py-0.5 text-xs font-semibold bg-primary-500/20 text-primary-400 rounded border border-primary-500/30">
                      Current
                    </span>
                  )}
                </div>
                <div className="mb-4">
                  <span className="text-3xl font-bold text-white">{formatCurrency(plan.priceMonthly)}</span>
                  <span className="text-slate-400 text-sm">/mo</span>
                </div>
                <ul className="space-y-2 mb-6 flex-1">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                      <Check className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>
                {isCurrent ? (
                  <button disabled className="w-full py-2.5 bg-slate-700 text-slate-400 rounded font-medium cursor-not-allowed">
                    Current Plan
                  </button>
                ) : hasSubscription ? (
                  <button
                    onClick={() => handleChangePlan(plan.planId)}
                    disabled={actionLoading === plan.planId}
                    className="w-full py-2.5 bg-primary-600 hover:bg-primary-500 text-white rounded font-medium transition-colors disabled:opacity-50"
                  >
                    {actionLoading === plan.planId ? 'Switching...' : 'Switch Plan'}
                  </button>
                ) : (
                  <button
                    onClick={() => handleCheckout(plan.planId)}
                    disabled={actionLoading === plan.planId}
                    className="w-full py-2.5 bg-primary-600 hover:bg-primary-500 text-white rounded font-medium transition-colors disabled:opacity-50"
                  >
                    {actionLoading === plan.planId ? 'Loading...' : 'Subscribe'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Invoices Table */}
      {overview && overview.recentInvoices.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-white mb-4">Invoices</h2>
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Date</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Amount</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Status</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody>
                {overview.recentInvoices.map((inv) => (
                  <tr key={inv.id} className="border-b border-slate-700/50 hover:bg-slate-700/20">
                    <td className="px-4 py-3 text-sm text-slate-300">{formatDate(inv.createdAt)}</td>
                    <td className="px-4 py-3 text-sm text-white font-medium">{formatCurrency(inv.amountPaid || inv.amountDue)}</td>
                    <td className="px-4 py-3">
                      {getStatusBadge(inv.status)}
                    </td>
                    <td className="px-4 py-3 text-right space-x-2">
                      {inv.invoiceUrl && (
                        <a href={inv.invoiceUrl} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-primary-400 hover:text-primary-300">
                          <ExternalLink className="w-3 h-3" /> View
                        </a>
                      )}
                      {inv.invoicePdf && (
                        <a href={inv.invoicePdf} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-300">
                          <FileText className="w-3 h-3" /> PDF
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Cancel Button */}
      {hasSubscription && !isCanceling && (
        <div className="pt-4 border-t border-slate-700">
          <button
            onClick={handleCancel}
            disabled={actionLoading === 'cancel'}
            className="px-4 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-colors"
          >
            <X className="w-4 h-4 inline mr-1" />
            Cancel Subscription
          </button>
        </div>
      )}
    </div>
  );
};

const UsageBar: React.FC<{ label: string; current: number; max: number }> = ({ label, current, max }) => {
  const isUnlimited = max < 0;
  const pct = isUnlimited ? 0 : Math.min((current / max) * 100, 100);
  const color = pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-500' : 'bg-emerald-500';

  return (
    <div className="bg-slate-900/50 rounded-lg p-4">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-slate-500 uppercase tracking-wider">{label}</span>
        <span className="text-xs text-slate-400">
          {current}/{isUnlimited ? '∞' : max}
        </span>
      </div>
      <div className="text-lg font-semibold text-white mb-2">
        {isUnlimited ? `${current} used` : `${Math.round(pct)}%`}
      </div>
      {!isUnlimited && (
        <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
          <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
        </div>
      )}
    </div>
  );
};

export default Billing;
