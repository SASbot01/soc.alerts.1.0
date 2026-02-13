import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, ArrowRight, Check, Server, Globe, Mail, Shield } from 'lucide-react';
import api from '../lib/api';
import clsx from 'clsx';

const Landing: React.FC = () => {
    const navigate = useNavigate();
    const [step, setStep] = useState(0);
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState('');

    const [form, setForm] = useState({
        companyName: '', domain: '', contactName: '', contactEmail: '', contactPhone: '',
        acceptsTerms: false, acceptsDpa: false, acceptsNda: false,
        monitorNetwork: false, monitorEndpoints: false, monitorCloud: false, monitorEmail: false,
        numServers: 0, numEndpoints: 0, numLocations: 1,
        currentSecurityTools: '', additionalNotes: '',
        alertEmail: '', alertSlackWebhook: '', preferredSla: 'standard',
    });

    const updateForm = (fields: Partial<typeof form>) => setForm({ ...form, ...fields });

    const handleSubmit = async () => {
        setError('');
        if (!form.acceptsTerms || !form.acceptsDpa) {
            setError('You must accept the Terms of Service and Data Processing Agreement.');
            return;
        }
        try {
            await api.post('/onboarding/submit', form);
            setSubmitted(true);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Submission failed. Please try again.');
        }
    };

    if (submitted) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
                <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0">
                    <div className="absolute -top-[20%] -left-[10%] w-[60%] h-[60%] rounded-full bg-primary-900/10 blur-[100px]" />
                    <div className="absolute top-[40%] -right-[10%] w-[50%] h-[50%] rounded-full bg-indigo-900/10 blur-[100px]" />
                </div>
                <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-[2px] p-8 max-w-md text-center relative z-10">
                    <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Check className="w-8 h-8 text-green-400" />
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-2">Request Submitted</h2>
                    <p className="text-slate-400 mb-6">Our team will review your request and contact you within 24-48 hours.</p>
                    <button onClick={() => navigate('/login')} className="px-6 py-2 bg-white hover:bg-[#E0E0E0] text-black rounded-[2px] transition-colors">
                        Go to Login
                    </button>
                </div>
            </div>
        );
    }

    const steps = ['Company Info', 'Legal', 'SOC Config', 'Infrastructure', 'Alerts'];

    return (
        <div className="min-h-screen bg-slate-950 relative overflow-hidden">
            {/* Background */}
            <div className="absolute top-0 left-0 w-full h-full z-0">
                <div className="absolute -top-[20%] -left-[10%] w-[60%] h-[60%] rounded-full bg-primary-900/10 blur-[100px]" />
                <div className="absolute top-[40%] -right-[10%] w-[50%] h-[50%] rounded-full bg-indigo-900/10 blur-[100px]" />
            </div>

            {/* Header */}
            <header className="relative z-10 flex items-center justify-between px-8 py-6">
                <div className="flex items-center gap-2">
                    <ShieldAlert className="w-8 h-8 text-primary-400" />
                    <span className="text-2xl font-bold headline-metallic">BlackWolf Defense</span>
                </div>
                <button onClick={() => navigate('/login')} className="px-4 py-2 text-slate-400 hover:text-white border border-slate-700 rounded-[2px] transition-colors">
                    Client Login
                </button>
            </header>

            {/* Hero */}
            {step === 0 && (
                <div className="relative z-10 max-w-4xl mx-auto text-center px-4 py-16">
                    <h1 className="text-5xl md:text-6xl font-bold text-white mb-6 leading-tight">
                        Enterprise-Grade <br />
                        <span className="headline-metallic">Security Operations</span>
                    </h1>
                    <p className="text-xl text-slate-400 mb-8 max-w-2xl mx-auto">
                        24/7 threat monitoring, incident response, and compliance management powered by advanced AI correlation engines.
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-12">
                        {[
                            { icon: Shield, label: 'Threat Detection', desc: 'Real-time analysis' },
                            { icon: Server, label: 'Sensor Network', desc: 'Distributed agents' },
                            { icon: Globe, label: 'Threat Intel', desc: 'Global enrichment' },
                            { icon: Mail, label: 'Alert System', desc: 'Multi-channel' },
                        ].map((f, i) => (
                            <div key={i} className="bg-slate-900/50 border border-slate-800 rounded-[2px] p-4 text-center">
                                <f.icon className="w-8 h-8 text-primary-400 mx-auto mb-2" />
                                <div className="text-white font-medium">{f.label}</div>
                                <div className="text-sm text-slate-500">{f.desc}</div>
                            </div>
                        ))}
                    </div>

                    <button onClick={() => setStep(1)} className="px-8 py-3 bg-white text-black font-semibold rounded-[2px] shadow-lg shadow-primary-500/20 hover:shadow-primary-500/30 transition-all flex items-center gap-2 mx-auto">
                        Request Access <ArrowRight className="w-5 h-5" />
                    </button>
                </div>
            )}

            {/* Multi-step form */}
            {step > 0 && (
                <div className="relative z-10 max-w-2xl mx-auto px-4 py-8">
                    {/* Progress */}
                    <div className="flex items-center justify-center gap-2 mb-8">
                        {steps.map((_s, i) => (
                            <React.Fragment key={i}>
                                <div className={clsx("w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border transition-all",
                                    i + 1 <= step ? "bg-white border-white text-black" : "border-slate-700 text-slate-500"
                                )}>{i + 1}</div>
                                {i < steps.length - 1 && <div className={clsx("w-8 h-0.5", i + 1 < step ? "bg-primary-500" : "bg-slate-700")} />}
                            </React.Fragment>
                        ))}
                    </div>
                    <h2 className="text-2xl font-bold text-white text-center mb-6">{steps[step - 1]}</h2>

                    {error && <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-[2px] text-red-400 text-sm">{error}</div>}

                    <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-[2px] p-6 space-y-4">
                        {/* Step 1: Company Info */}
                        {step === 1 && (
                            <>
                                <Input label="Company Name" value={form.companyName} onChange={v => updateForm({ companyName: v })} required />
                                <Input label="Domain" value={form.domain} onChange={v => updateForm({ domain: v })} placeholder="company.com" required />
                                <Input label="Contact Name" value={form.contactName} onChange={v => updateForm({ contactName: v })} required />
                                <Input label="Contact Email" value={form.contactEmail} onChange={v => updateForm({ contactEmail: v })} type="email" required />
                                <Input label="Contact Phone" value={form.contactPhone} onChange={v => updateForm({ contactPhone: v })} />
                            </>
                        )}

                        {/* Step 2: Legal */}
                        {step === 2 && (
                            <>
                                <p className="text-sm text-slate-400 mb-2">To proceed with the SOC onboarding, the following legal agreements are required:</p>
                                <Checkbox label="I accept the Terms of Service *" checked={form.acceptsTerms} onChange={v => updateForm({ acceptsTerms: v })} />
                                <Checkbox label="I accept the Data Processing Agreement (DPA) *" checked={form.acceptsDpa} onChange={v => updateForm({ acceptsDpa: v })} />
                                <Checkbox label="I accept the Non-Disclosure Agreement (NDA)" checked={form.acceptsNda} onChange={v => updateForm({ acceptsNda: v })} />
                                <p className="text-xs text-slate-600 mt-2">* Required fields</p>
                            </>
                        )}

                        {/* Step 3: SOC Config */}
                        {step === 3 && (
                            <>
                                <p className="text-sm text-slate-400 mb-2">Select the monitoring areas for your organization:</p>
                                <Checkbox label="Network Monitoring (IDS/IPS, firewall, traffic analysis)" checked={form.monitorNetwork} onChange={v => updateForm({ monitorNetwork: v })} />
                                <Checkbox label="Endpoint Monitoring (EDR, antivirus, host-based)" checked={form.monitorEndpoints} onChange={v => updateForm({ monitorEndpoints: v })} />
                                <Checkbox label="Cloud Monitoring (AWS, Azure, GCP)" checked={form.monitorCloud} onChange={v => updateForm({ monitorCloud: v })} />
                                <Checkbox label="Email Security Monitoring" checked={form.monitorEmail} onChange={v => updateForm({ monitorEmail: v })} />
                                <div className="mt-4">
                                    <label className="text-sm text-slate-300">Current Security Tools</label>
                                    <textarea value={form.currentSecurityTools} onChange={e => updateForm({ currentSecurityTools: e.target.value })} rows={2} className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-[2px] px-3 py-2 text-white text-sm" placeholder="List your current security tools..." />
                                </div>
                            </>
                        )}

                        {/* Step 4: Infrastructure */}
                        {step === 4 && (
                            <>
                                <div className="grid grid-cols-3 gap-4">
                                    <Input label="Servers" type="number" value={String(form.numServers)} onChange={v => updateForm({ numServers: parseInt(v) || 0 })} />
                                    <Input label="Endpoints" type="number" value={String(form.numEndpoints)} onChange={v => updateForm({ numEndpoints: parseInt(v) || 0 })} />
                                    <Input label="Locations" type="number" value={String(form.numLocations)} onChange={v => updateForm({ numLocations: parseInt(v) || 0 })} />
                                </div>
                                <div>
                                    <label className="text-sm text-slate-300">Additional Notes</label>
                                    <textarea value={form.additionalNotes} onChange={e => updateForm({ additionalNotes: e.target.value })} rows={3} className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-[2px] px-3 py-2 text-white text-sm" placeholder="Any special requirements..." />
                                </div>
                            </>
                        )}

                        {/* Step 5: Alerts */}
                        {step === 5 && (
                            <>
                                <Input label="Alert Email" value={form.alertEmail} onChange={v => updateForm({ alertEmail: v })} type="email" placeholder="alerts@company.com" />
                                <Input label="Slack Webhook (optional)" value={form.alertSlackWebhook} onChange={v => updateForm({ alertSlackWebhook: v })} placeholder="https://hooks.slack.com/..." />
                                <div>
                                    <label className="text-sm text-slate-300">Preferred SLA</label>
                                    <select value={form.preferredSla} onChange={e => updateForm({ preferredSla: e.target.value })} className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-[2px] px-3 py-2 text-white text-sm">
                                        <option value="basic">Basic (24h response)</option>
                                        <option value="standard">Standard (8h response)</option>
                                        <option value="premium">Premium (2h response)</option>
                                        <option value="enterprise">Enterprise (30min response)</option>
                                    </select>
                                </div>
                            </>
                        )}
                    </div>

                    {/* Nav Buttons */}
                    <div className="flex justify-between mt-6">
                        <button onClick={() => setStep(step - 1)} className="px-6 py-2 text-slate-400 hover:text-white transition-colors">
                            Back
                        </button>
                        {step < 5 ? (
                            <button onClick={() => setStep(step + 1)} className="px-6 py-2 bg-white hover:bg-[#E0E0E0] text-black rounded-[2px] transition-colors flex items-center gap-2">
                                Next <ArrowRight className="w-4 h-4" />
                            </button>
                        ) : (
                            <button onClick={handleSubmit} className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-[2px] transition-colors">
                                Submit Request
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* Footer */}
            <footer className="relative z-10 text-center py-8 text-xs text-slate-600">
                &copy; 2024 BlackWolf Defense. Enterprise Security Operations.
            </footer>
        </div>
    );
};

// Helper components
const Input: React.FC<{ label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string; required?: boolean }> = ({ label, value, onChange, type = 'text', placeholder, required }) => (
    <div>
        <label className="text-sm text-slate-300">{label}{required && ' *'}</label>
        <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} required={required}
            className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-[2px] px-3 py-2 text-white text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500/50 transition-all" />
    </div>
);

const Checkbox: React.FC<{ label: string; checked: boolean; onChange: (v: boolean) => void }> = ({ label, checked, onChange }) => (
    <label className="flex items-center gap-3 cursor-pointer group">
        <div className={clsx("w-5 h-5 rounded border flex items-center justify-center transition-all",
            checked ? "bg-white border-white" : "border-slate-600 group-hover:border-slate-400"
        )}>
            {checked && <Check className="w-3 h-3 text-white" />}
        </div>
        <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="hidden" />
        <span className="text-sm text-slate-300">{label}</span>
    </label>
);

export default Landing;
