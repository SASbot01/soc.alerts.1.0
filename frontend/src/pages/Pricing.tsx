import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ShieldAlert, Check, ArrowRight, Shield, Brain, Radio, Zap,
    Users, Clock, Lock, ChevronDown, ChevronUp, Globe, BarChart3
} from 'lucide-react';
import clsx from 'clsx';

interface Plan {
    name: string;
    price: string;
    period: string;
    description: string;
    popular?: boolean;
    features: string[];
    limits: { assets: string; users: string; retention: string };
    cta: string;
    sla: string;
}

const plans: Plan[] = [
    {
        name: 'Starter',
        price: '$1,999',
        period: '/month',
        description: 'For growing companies that need professional security monitoring.',
        limits: { assets: '50 assets', users: '5 users', retention: '30-day retention' },
        sla: '24h SLA',
        cta: 'Start Free Trial',
        features: [
            'Real-time threat detection',
            'AI-powered analysis (Claude)',
            'Incident management',
            'MITRE ATT&CK mapping',
            'Email & Slack alerts',
            'Network IDS (Suricata)',
            'Auth log monitoring',
            'Honeypot sensors',
            'Basic playbooks',
            'Compliance dashboard',
        ],
    },
    {
        name: 'Professional',
        price: '$4,999',
        period: '/month',
        popular: true,
        description: 'For mid-market companies that need full SOC capabilities and faster response.',
        limits: { assets: '200 assets', users: '15 users', retention: '90-day retention' },
        sla: '2h SLA',
        cta: 'Start Free Trial',
        features: [
            'Everything in Starter, plus:',
            'Autonomous AI agent (24/7)',
            'Auto-block malicious IPs',
            'Auto-create incidents',
            'Advanced correlation engine',
            'SOAR playbook automation',
            'Multi-channel alerting',
            'Vulnerability management',
            'Penetration test tracking',
            'Certification management',
            'Role-based access (RBAC)',
            'API key management',
            'Priority support',
        ],
    },
    {
        name: 'Enterprise',
        price: '$9,999',
        period: '/month',
        description: 'For large organizations that need unlimited scale and dedicated support.',
        limits: { assets: '500 assets', users: 'Unlimited users', retention: '1-year retention' },
        sla: '30min SLA',
        cta: 'Contact Sales',
        features: [
            'Everything in Professional, plus:',
            'Unlimited users',
            '1-year data retention',
            'Custom correlation rules',
            'Dedicated account manager',
            'Custom integrations',
            'On-premise sensor deployment',
            'Executive reporting',
            'SLA guarantees',
            'SOC 2 compliance support',
        ],
    },
];

const faqs = [
    {
        q: 'How does the 14-day free trial work?',
        a: 'You get full access to all features of your chosen plan for 14 days. No credit card required to start. Deploy sensors, configure alerts, and see real threats detected before committing.',
    },
    {
        q: 'What happens after the trial ends?',
        a: 'You choose a plan to continue. If you don\'t subscribe, your dashboard remains accessible in read-only mode for 30 days so you can export your data.',
    },
    {
        q: 'How quickly can I deploy?',
        a: 'Most customers are fully operational within 2 hours. Our sensors deploy as Docker containers — one command and you\'re monitoring. Our AI begins analyzing threats from minute one.',
    },
    {
        q: 'What types of threats do you detect?',
        a: 'Network intrusions, brute force attacks, port scans, web application attacks (SQL injection, XSS), malware communication, data exfiltration, SSH attacks, and more. Our AI correlation engine connects related events across all sensors.',
    },
    {
        q: 'Can I upgrade or downgrade my plan?',
        a: 'Yes, at any time. Upgrades take effect immediately with prorated billing. Downgrades take effect at the next billing cycle.',
    },
    {
        q: 'Is my data secure?',
        a: 'All data is encrypted in transit (TLS 1.3) and at rest (AES-256). Multi-tenant isolation ensures each company\'s data is completely separate. We support MFA/TOTP and granular RBAC.',
    },
];

const stats = [
    { value: '< 2 min', label: 'Average Detection Time' },
    { value: '99.9%', label: 'Uptime SLA' },
    { value: '24/7', label: 'AI Monitoring' },
    { value: '50+', label: 'Threat Categories' },
];

const Pricing: React.FC = () => {
    const navigate = useNavigate();
    const [openFaq, setOpenFaq] = useState<number | null>(null);
    const [annual, setAnnual] = useState(false);

    const getPrice = (plan: Plan) => {
        if (!annual) return plan.price;
        const monthly = parseInt(plan.price.replace(/[^0-9]/g, ''));
        const annualPrice = Math.round(monthly * 10); // 2 months free
        return '$' + annualPrice.toLocaleString();
    };

    const handleCta = (plan: Plan) => {
        if (plan.name === 'Enterprise') {
            window.location.href = 'mailto:sales@blackwolfsec.io?subject=Enterprise%20Plan%20Inquiry';
        } else {
            navigate('/landing');
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 relative overflow-hidden">
            {/* Background effects */}
            <div className="absolute top-0 left-0 w-full h-full z-0 pointer-events-none">
                <div className="absolute -top-[20%] -left-[10%] w-[60%] h-[60%] rounded-full bg-red-900/5 blur-[120px]" />
                <div className="absolute top-[30%] -right-[15%] w-[50%] h-[50%] rounded-full bg-indigo-900/5 blur-[120px]" />
                <div className="absolute bottom-[10%] left-[20%] w-[40%] h-[40%] rounded-full bg-red-900/3 blur-[100px]" />
            </div>

            {/* Header */}
            <header className="relative z-10 flex items-center justify-between px-8 py-6 max-w-7xl mx-auto">
                <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/landing')}>
                    <ShieldAlert className="w-8 h-8 text-red-500" />
                    <span className="text-2xl font-bold">
                        <span className="text-white">BLACK</span>
                        <span className="text-red-500">WOLF</span>
                        <span className="text-slate-500 ml-2 text-sm font-normal">SOC</span>
                    </span>
                </div>
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate('/landing')} className="px-4 py-2 text-slate-400 hover:text-white transition-colors text-sm">
                        Request Access
                    </button>
                    <button onClick={() => navigate('/login')} className="px-5 py-2 bg-white/10 hover:bg-white/20 text-white border border-slate-700 rounded-[2px] transition-all text-sm">
                        Client Login
                    </button>
                </div>
            </header>

            {/* Hero */}
            <section className="relative z-10 max-w-5xl mx-auto text-center px-4 pt-16 pb-12">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-red-500/10 border border-red-500/20 rounded-full text-red-400 text-sm mb-8">
                    <Shield className="w-4 h-4" />
                    <span>Enterprise-grade SOC at a fraction of the cost</span>
                </div>

                <h1 className="text-4xl md:text-6xl font-bold text-white mb-6 leading-tight tracking-tight">
                    Security That <span className="text-red-500">Never Sleeps</span>
                </h1>
                <p className="text-lg text-slate-400 mb-8 max-w-2xl mx-auto">
                    AI-powered threat detection, automated incident response, and full compliance management.
                    Deploy in hours, not months.
                </p>

                {/* Stats row */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-3xl mx-auto mb-12">
                    {stats.map((s, i) => (
                        <div key={i} className="text-center">
                            <div className="text-2xl md:text-3xl font-bold text-white">{s.value}</div>
                            <div className="text-xs text-slate-500 mt-1">{s.label}</div>
                        </div>
                    ))}
                </div>
            </section>

            {/* Billing toggle */}
            <section className="relative z-10 max-w-7xl mx-auto px-4 mb-12">
                <div className="flex items-center justify-center gap-4">
                    <span className={clsx("text-sm font-medium", !annual ? "text-white" : "text-slate-500")}>Monthly</span>
                    <button
                        onClick={() => setAnnual(!annual)}
                        className={clsx(
                            "relative w-14 h-7 rounded-full transition-colors",
                            annual ? "bg-red-500" : "bg-slate-700"
                        )}
                    >
                        <div className={clsx(
                            "absolute top-1 w-5 h-5 rounded-full bg-white transition-transform",
                            annual ? "translate-x-8" : "translate-x-1"
                        )} />
                    </button>
                    <span className={clsx("text-sm font-medium", annual ? "text-white" : "text-slate-500")}>
                        Annual <span className="text-green-400 text-xs ml-1">Save 17%</span>
                    </span>
                </div>
            </section>

            {/* Pricing Cards */}
            <section className="relative z-10 max-w-7xl mx-auto px-4 mb-24">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
                    {plans.map((plan) => (
                        <div
                            key={plan.name}
                            className={clsx(
                                "relative rounded-lg p-8 transition-all duration-300",
                                plan.popular
                                    ? "bg-slate-900/80 border-2 border-red-500/50 shadow-lg shadow-red-500/10 scale-[1.02] md:scale-105"
                                    : "bg-slate-900/50 border border-slate-800 hover:border-slate-700"
                            )}
                        >
                            {plan.popular && (
                                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-red-500 text-white text-xs font-bold uppercase tracking-wider rounded-full">
                                    Most Popular
                                </div>
                            )}

                            <div className="mb-6">
                                <h3 className="text-lg font-semibold text-white mb-1">{plan.name}</h3>
                                <p className="text-sm text-slate-500 mb-4">{plan.description}</p>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-4xl font-bold text-white">{getPrice(plan)}</span>
                                    <span className="text-slate-500">{annual ? '/month (billed annually)' : plan.period}</span>
                                </div>
                            </div>

                            {/* Limits */}
                            <div className="flex flex-wrap gap-2 mb-6">
                                {Object.values(plan.limits).map((l, i) => (
                                    <span key={i} className="px-3 py-1 bg-slate-800 rounded text-xs text-slate-300">{l}</span>
                                ))}
                                <span className="px-3 py-1 bg-slate-800 rounded text-xs text-slate-300">{plan.sla}</span>
                            </div>

                            <button
                                onClick={() => handleCta(plan)}
                                className={clsx(
                                    "w-full py-3 rounded-[2px] font-semibold text-sm transition-all flex items-center justify-center gap-2 mb-8",
                                    plan.popular
                                        ? "bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/25"
                                        : "bg-white hover:bg-slate-100 text-black"
                                )}
                            >
                                {plan.cta}
                                <ArrowRight className="w-4 h-4" />
                            </button>

                            {/* Features */}
                            <ul className="space-y-3">
                                {plan.features.map((f, i) => (
                                    <li key={i} className="flex items-start gap-3 text-sm">
                                        {f.includes('Everything in') ? (
                                            <span className="text-slate-400 font-medium">{f}</span>
                                        ) : (
                                            <>
                                                <Check className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                                                <span className="text-slate-300">{f}</span>
                                            </>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>
            </section>

            {/* Feature Comparison Table */}
            <section className="relative z-10 max-w-5xl mx-auto px-4 mb-24">
                <h2 className="text-3xl font-bold text-white text-center mb-12">Full Feature Comparison</h2>
                <div className="bg-slate-900/50 border border-slate-800 rounded-lg overflow-hidden">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-slate-800">
                                <th className="text-left py-4 px-6 text-slate-400 text-sm font-medium">Feature</th>
                                <th className="text-center py-4 px-4 text-slate-400 text-sm font-medium">Starter</th>
                                <th className="text-center py-4 px-4 text-red-400 text-sm font-medium">Professional</th>
                                <th className="text-center py-4 px-4 text-slate-400 text-sm font-medium">Enterprise</th>
                            </tr>
                        </thead>
                        <tbody>
                            {[
                                { feature: 'Monitored Assets', s: '50', p: '200', e: '500' },
                                { feature: 'Team Members', s: '5', p: '15', e: 'Unlimited' },
                                { feature: 'Data Retention', s: '30 days', p: '90 days', e: '1 year' },
                                { feature: 'Threat Detection (IDS)', s: true, p: true, e: true },
                                { feature: 'AI Analysis (Claude)', s: true, p: true, e: true },
                                { feature: 'MITRE ATT&CK Mapping', s: true, p: true, e: true },
                                { feature: 'Email & Slack Alerts', s: true, p: true, e: true },
                                { feature: 'Incident Management', s: true, p: true, e: true },
                                { feature: 'Autonomous AI Agent', s: false, p: true, e: true },
                                { feature: 'Auto-Block Malicious IPs', s: false, p: true, e: true },
                                { feature: 'SOAR Playbooks', s: 'Basic', p: 'Full', e: 'Custom' },
                                { feature: 'Correlation Engine', s: false, p: true, e: true },
                                { feature: 'Vulnerability Mgmt', s: false, p: true, e: true },
                                { feature: 'Pentest Tracking', s: false, p: true, e: true },
                                { feature: 'Compliance (SOC2, ISO)', s: false, p: true, e: true },
                                { feature: 'RBAC / Custom Roles', s: false, p: true, e: true },
                                { feature: 'API Access', s: 'Read-only', p: 'Full', e: 'Full' },
                                { feature: 'MFA / TOTP', s: true, p: true, e: true },
                                { feature: 'Dedicated Support', s: false, p: false, e: true },
                                { feature: 'Custom Integrations', s: false, p: false, e: true },
                                { feature: 'SLA Guarantee', s: '24h', p: '2h', e: '30min' },
                            ].map((row, i) => (
                                <tr key={i} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                                    <td className="py-3 px-6 text-sm text-slate-300">{row.feature}</td>
                                    <td className="py-3 px-4 text-center">{renderCell(row.s)}</td>
                                    <td className="py-3 px-4 text-center bg-red-500/5">{renderCell(row.p)}</td>
                                    <td className="py-3 px-4 text-center">{renderCell(row.e)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>

            {/* How it works */}
            <section className="relative z-10 max-w-5xl mx-auto px-4 mb-24">
                <h2 className="text-3xl font-bold text-white text-center mb-4">Operational in Hours, Not Months</h2>
                <p className="text-slate-400 text-center mb-12 max-w-2xl mx-auto">
                    Traditional SOC deployments take 3-6 months and cost $500K+. BlackWolf is live the same day.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    {[
                        { step: '1', icon: Users, title: 'Sign Up', desc: 'Create your account and choose a plan. Start your 14-day free trial.' },
                        { step: '2', icon: Radio, title: 'Deploy Sensors', desc: 'One Docker command per sensor. Network IDS, auth monitor, honeypots.' },
                        { step: '3', icon: Brain, title: 'AI Activates', desc: 'Our AI agent starts analyzing threats, correlating events, and learning your environment.' },
                        { step: '4', icon: Shield, title: 'Protected', desc: '24/7 autonomous monitoring. Auto-blocking, incident creation, and executive reports.' },
                    ].map((s, i) => (
                        <div key={i} className="text-center">
                            <div className="w-14 h-14 rounded-full bg-slate-900 border border-slate-700 flex items-center justify-center mx-auto mb-4 relative">
                                <s.icon className="w-6 h-6 text-red-400" />
                                <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center">
                                    {s.step}
                                </div>
                            </div>
                            <h3 className="text-white font-semibold mb-2">{s.title}</h3>
                            <p className="text-sm text-slate-500">{s.desc}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* Capabilities */}
            <section className="relative z-10 max-w-6xl mx-auto px-4 mb-24">
                <h2 className="text-3xl font-bold text-white text-center mb-12">What Makes BlackWolf Different</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {[
                        { icon: Brain, title: 'AI-Powered Analysis', desc: 'Claude AI analyzes every threat, creates incidents, and learns from analyst corrections. Not just rules — actual intelligence.' },
                        { icon: Zap, title: 'Autonomous Response', desc: 'Auto-block malicious IPs, auto-create incidents, execute playbooks — all without human intervention when configured.' },
                        { icon: BarChart3, title: 'Correlation Engine', desc: 'Connects events across sensors: a port scan + brute force + login success from the same IP = auto-escalated incident.' },
                        { icon: Globe, title: 'Threat Intelligence', desc: 'AbuseIPDB integration, community threat feeds, and cross-tenant pattern detection (anonymized) across all customers.' },
                        { icon: Lock, title: 'Compliance Built-In', desc: 'SOC 2, ISO 27001, GDPR readiness with audit logging, penetration test tracking, and certification management.' },
                        { icon: Clock, title: 'Deploy in Minutes', desc: 'Docker-based sensors deploy anywhere. Suricata IDS, auth monitor, honeypots, and web application firewall — all one-command.' },
                    ].map((c, i) => (
                        <div key={i} className="bg-slate-900/50 border border-slate-800 rounded-lg p-6 hover:border-slate-700 transition-colors">
                            <c.icon className="w-8 h-8 text-red-400 mb-4" />
                            <h3 className="text-white font-semibold mb-2">{c.title}</h3>
                            <p className="text-sm text-slate-500 leading-relaxed">{c.desc}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* Social Proof */}
            <section className="relative z-10 max-w-5xl mx-auto px-4 mb-24">
                <div className="bg-gradient-to-r from-red-500/10 via-slate-900/50 to-red-500/10 border border-slate-800 rounded-lg p-12 text-center">
                    <p className="text-2xl text-white font-light italic mb-6 leading-relaxed max-w-3xl mx-auto">
                        "Most mid-market companies can't afford a $500K/year SOC team. BlackWolf gives you
                        the same capabilities at 10% of the cost, with AI that actually works."
                    </p>
                    <div className="text-slate-400 text-sm">Built by security engineers. Powered by Claude AI.</div>
                </div>
            </section>

            {/* FAQ */}
            <section className="relative z-10 max-w-3xl mx-auto px-4 mb-24">
                <h2 className="text-3xl font-bold text-white text-center mb-12">Frequently Asked Questions</h2>
                <div className="space-y-3">
                    {faqs.map((faq, i) => (
                        <div
                            key={i}
                            className="bg-slate-900/50 border border-slate-800 rounded-lg overflow-hidden"
                        >
                            <button
                                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                                className="w-full flex items-center justify-between p-5 text-left hover:bg-slate-800/30 transition-colors"
                            >
                                <span className="text-white font-medium text-sm pr-4">{faq.q}</span>
                                {openFaq === i
                                    ? <ChevronUp className="w-5 h-5 text-slate-500 flex-shrink-0" />
                                    : <ChevronDown className="w-5 h-5 text-slate-500 flex-shrink-0" />}
                            </button>
                            {openFaq === i && (
                                <div className="px-5 pb-5">
                                    <p className="text-sm text-slate-400 leading-relaxed">{faq.a}</p>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </section>

            {/* Final CTA */}
            <section className="relative z-10 max-w-4xl mx-auto px-4 pb-24 text-center">
                <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                    Start Protecting Your Business Today
                </h2>
                <p className="text-slate-400 mb-8 max-w-xl mx-auto">
                    14-day free trial. No credit card required. Deploy your first sensor in under 5 minutes.
                </p>
                <div className="flex items-center justify-center gap-4 flex-wrap">
                    <button
                        onClick={() => navigate('/landing')}
                        className="px-8 py-3 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-[2px] shadow-lg shadow-red-500/25 transition-all flex items-center gap-2"
                    >
                        Start Free Trial <ArrowRight className="w-5 h-5" />
                    </button>
                    <button
                        onClick={() => window.location.href = 'mailto:sales@blackwolfsec.io?subject=Demo%20Request'}
                        className="px-8 py-3 bg-transparent hover:bg-white/5 text-white border border-slate-700 rounded-[2px] transition-all"
                    >
                        Request Demo
                    </button>
                </div>
            </section>

            {/* Footer */}
            <footer className="relative z-10 border-t border-slate-800 py-12">
                <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                        <ShieldAlert className="w-5 h-5 text-red-500" />
                        <span className="text-sm text-slate-500">
                            <span className="text-slate-300">BLACK</span><span className="text-red-500">WOLF</span> SOC
                        </span>
                    </div>
                    <div className="flex items-center gap-6 text-sm text-slate-600">
                        <button onClick={() => navigate('/landing')} className="hover:text-slate-400 transition-colors">Onboarding</button>
                        <button onClick={() => navigate('/login')} className="hover:text-slate-400 transition-colors">Login</button>
                        <span>&copy; 2026 BlackWolf Security. All rights reserved.</span>
                    </div>
                </div>
            </footer>
        </div>
    );
};

const renderCell = (val: boolean | string) => {
    if (val === true) return <Check className="w-4 h-4 text-green-400 mx-auto" />;
    if (val === false) return <span className="text-slate-700">—</span>;
    return <span className="text-sm text-slate-300">{val}</span>;
};

export default Pricing;
