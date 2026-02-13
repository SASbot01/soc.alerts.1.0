import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';
import { ShieldAlert, ArrowRight, Lock, Building2, User } from 'lucide-react';
import clsx from 'clsx';

const Login: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [domain, setDomain] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const { login } = useAuth();
    const navigate = useNavigate();

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

            login(res.data.accessToken, res.data.refreshToken, res.data.user);
            navigate('/');
        } catch (err: any) {
            const msg = err.response?.data?.message || 'Login failed. Check credentials.';
            setError(msg.includes('Too many') ? msg : 'Invalid credentials. Please try again.');
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

                {error && (
                    <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-[2px] text-red-400 text-sm font-medium flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
                        <ShieldAlert className="w-4 h-4 flex-shrink-0" />
                        {error}
                    </div>
                )}

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

                    <div className="text-center mt-4">
                        <a href="#" className="text-sm text-slate-500 hover:text-primary-400 transition-colors">Forgot credentials?</a>
                    </div>
                </form>
            </div>

            <div className="absolute bottom-6 text-center w-full z-10 text-xs text-slate-600">
                &copy; 2024 BlackWolf Security. Enterprise Defense Systems.
            </div>
        </div>
    );
};

export default Login;
