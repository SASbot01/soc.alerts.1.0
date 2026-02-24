import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';
import { ssoService } from '../lib/services';
import { ShieldAlert, ArrowRight, Lock, Building2, User, Shield, Globe, CheckCircle2 } from 'lucide-react';
import clsx from 'clsx';

const Login: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [domain, setDomain] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    // MFA state
    const [mfaRequired, setMfaRequired] = useState(false);
    const [mfaToken, setMfaToken] = useState('');
    const [mfaCode, setMfaCode] = useState('');

    // SSO state
    const [ssoEnabled, setSsoEnabled] = useState(false);
    const [ssoLoading, setSsoLoading] = useState(false);

    const { login } = useAuth();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    // Handle SSO callback
    useEffect(() => {
        const code = searchParams.get('code');
        const ssoDomain = localStorage.getItem('sso_domain');
        if (code && ssoDomain && searchParams.get('sso_callback')) {
            handleSsoCallback(ssoDomain, code);
        }
    }, [searchParams]);

    // Check SSO when domain changes
    useEffect(() => {
        const timer = setTimeout(() => {
            if (domain.trim().length > 3) {
                ssoService.checkSso(domain.trim())
                    .then(res => setSsoEnabled(res.ssoEnabled))
                    .catch(() => setSsoEnabled(false));
            } else {
                setSsoEnabled(false);
            }
        }, 500);
        return () => clearTimeout(timer);
    }, [domain]);

    const handleSsoCallback = async (ssoDomain: string, code: string) => {
        setLoading(true);
        setError('');
        try {
            const res = await ssoService.callback(ssoDomain, code);
            localStorage.removeItem('sso_domain');
            login(res.accessToken, res.refreshToken, res.user, res.permissions);
            navigate('/');
        } catch (err: any) {
            setError(err.response?.data?.message || 'SSO login failed.');
            localStorage.removeItem('sso_domain');
        } finally {
            setLoading(false);
        }
    };

    const handleSsoLogin = async () => {
        setSsoLoading(true);
        setError('');
        try {
            localStorage.setItem('sso_domain', domain.trim());
            const res = await ssoService.authorize(domain.trim());
            window.location.href = res.authorizationUrl;
        } catch (err: any) {
            setError(err.response?.data?.message || 'SSO is not configured for this domain.');
            setSsoLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const res = await api.post('/auth/login', {
                email,
                password,
                companyDomain: domain.trim() || null
            });

            if (res.data.requiresMfa) {
                setMfaRequired(true);
                setMfaToken(res.data.mfaToken);
                setLoading(false);
                return;
            }

            login(res.data.accessToken, res.data.refreshToken, res.data.user, res.data.permissions);
            navigate('/');
        } catch (err: any) {
            const msg = err.response?.data?.message || 'Login failed. Check credentials.';
            setError(msg.includes('Too many') ? msg : 'Invalid credentials. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleMfaSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const res = await api.post('/auth/mfa-verify', {
                mfaToken,
                code: mfaCode,
            });

            login(res.data.accessToken, res.data.refreshToken, res.data.user, res.data.permissions);
            navigate('/');
        } catch (err: any) {
            setError(err.response?.data?.message || 'Invalid MFA code. Try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
            {/* Background Effects */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0">
                <div className="absolute -top-[20%] -left-[10%] w-[60%] h-[60%] rounded-full bg-primary-900/10 blur-[100px]" />
                <div className="absolute top-[40%] -right-[10%] w-[50%] h-[50%] rounded-full bg-indigo-900/10 blur-[100px]" />
            </div>

            <div className="w-full max-w-md bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-[2px] shadow-2xl relative z-10 p-8">
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-[2px] bg-white/5 mb-4 border border-[#333333]">
                        <ShieldAlert className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="text-3xl font-bold font-headline tracking-[0.2em] headline-metallic mb-2">BLACKWOLF</h1>
                    <p className="text-[#999999] text-sm tracking-[0.2em] uppercase">Enterprise Defense Systems</p>
                </div>

                {searchParams.get('provisioned') === 'true' && (
                    <div className="mb-6 p-4 bg-green-500/10 border border-green-500/20 rounded-[2px] text-green-400 text-sm font-medium flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
                        <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                        Your account is ready! Check your email for login credentials.
                    </div>
                )}

                {error && (
                    <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-[2px] text-red-400 text-sm font-medium flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
                        <ShieldAlert className="w-4 h-4 flex-shrink-0" />
                        {error}
                    </div>
                )}

                {mfaRequired ? (
                    <form onSubmit={handleMfaSubmit} className="space-y-5">
                        <div className="text-center mb-2">
                            <Shield className="w-10 h-10 text-primary-400 mx-auto mb-2" />
                            <p className="text-slate-300 text-sm">Enter the 6-digit code from your authenticator app</p>
                        </div>

                        <input
                            type="text"
                            value={mfaCode}
                            onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 8))}
                            className="w-full bg-slate-950/50 border border-slate-700 rounded-[2px] py-3 px-4 text-white text-center text-2xl tracking-[0.5em] focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500/50"
                            placeholder="000000"
                            maxLength={8}
                            autoFocus
                        />
                        <p className="text-xs text-slate-500 text-center">You can also use a recovery code</p>

                        <button
                            type="submit"
                            disabled={loading || mfaCode.length < 6}
                            className={clsx(
                                "w-full bg-white text-black font-semibold py-3 rounded-[2px] shadow-lg shadow-white/10 hover:bg-[#E0E0E0] active:scale-[0.98] transition-all flex items-center justify-center gap-2 text-xs uppercase tracking-[0.1em]",
                                (loading || mfaCode.length < 6) && "opacity-70 cursor-not-allowed"
                            )}
                        >
                            {loading ? 'Verifying...' : 'Verify Code'}
                        </button>

                        <button
                            type="button"
                            onClick={() => { setMfaRequired(false); setMfaCode(''); setError(''); }}
                            className="w-full text-sm text-slate-500 hover:text-primary-400 transition-colors"
                        >
                            Back to login
                        </button>
                    </form>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div className="space-y-1">
                            <label className="text-sm font-medium text-slate-300 ml-1">Company Domain <span className="text-slate-500 font-normal">(leave empty for superadmin)</span></label>
                            <div className="relative group">
                                <Building2 className="absolute left-3 top-3 w-5 h-5 text-slate-500 group-focus-within:text-primary-400 transition-colors" />
                                <input
                                    type="text"
                                    value={domain}
                                    onChange={(e) => setDomain(e.target.value)}
                                    className="w-full bg-slate-950/50 border border-slate-700 rounded-[2px] py-2.5 pl-10 pr-4 text-white focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500/50 transition-all"
                                    placeholder="company.com"
                                />
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-sm font-medium text-slate-300 ml-1">Email Address</label>
                            <div className="relative group">
                                <User className="absolute left-3 top-3 w-5 h-5 text-slate-500 group-focus-within:text-primary-400 transition-colors" />
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full bg-slate-950/50 border border-slate-700 rounded-[2px] py-2.5 pl-10 pr-4 text-white focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500/50 transition-all"
                                    placeholder="name@company.com"
                                    required
                                />
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-sm font-medium text-slate-300 ml-1">Password</label>
                            <div className="relative group">
                                <Lock className="absolute left-3 top-3 w-5 h-5 text-slate-500 group-focus-within:text-primary-400 transition-colors" />
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full bg-slate-950/50 border border-slate-700 rounded-[2px] py-2.5 pl-10 pr-4 text-white focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500/50 transition-all"
                                    placeholder="••••••••"
                                    required
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className={clsx(
                                "w-full bg-white text-black font-semibold py-3 rounded-[2px] shadow-lg shadow-white/10 hover:bg-[#E0E0E0] active:scale-[0.98] transition-all flex items-center justify-center gap-2 text-xs uppercase tracking-[0.1em]",
                                loading && "opacity-70 cursor-not-allowed"
                            )}
                        >
                            {loading ? 'Authenticating...' : (
                                <>Access Secure Portal <ArrowRight className="w-4 h-4 ml-1" /></>
                            )}
                        </button>

                        {ssoEnabled && (
                            <div className="relative">
                                <div className="absolute inset-0 flex items-center">
                                    <div className="w-full border-t border-slate-700"></div>
                                </div>
                                <div className="relative flex justify-center text-xs">
                                    <span className="bg-slate-900/60 px-3 text-slate-500">or</span>
                                </div>
                            </div>
                        )}

                        {ssoEnabled && (
                            <button
                                type="button"
                                onClick={handleSsoLogin}
                                disabled={ssoLoading}
                                className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 rounded-[2px] transition-all text-xs uppercase tracking-[0.1em] font-semibold"
                            >
                                <Globe className="w-4 h-4" />
                                {ssoLoading ? 'Redirecting...' : 'Sign in with SSO'}
                            </button>
                        )}

                        <div className="text-center mt-4">
                            <a href="#" className="text-sm text-slate-500 hover:text-primary-400 transition-colors">Forgot credentials?</a>
                        </div>
                    </form>
                )}
            </div>

            <div className="absolute bottom-6 text-center w-full z-10 text-xs text-slate-600">
                &copy; 2024 BlackWolf Security. Enterprise Defense Systems.
            </div>
        </div>
    );
};

export default Login;
