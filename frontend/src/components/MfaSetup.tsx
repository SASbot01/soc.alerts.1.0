import React, { useState } from 'react';
import { Shield, Copy, CheckCircle, AlertCircle } from 'lucide-react';
import api from '../lib/api';

interface MfaSetupProps {
  onComplete: () => void;
  onCancel: () => void;
}

type Step = 'init' | 'scan' | 'verify' | 'done';

const MfaSetup: React.FC<MfaSetupProps> = ({ onComplete, onCancel }) => {
  const [step, setStep] = useState<Step>('init');
  const [qrCode, setQrCode] = useState('');
  const [secret, setSecret] = useState('');
  const [code, setCode] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const startSetup = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.post('/mfa/setup');
      setQrCode(res.data.qrCode);
      setSecret(res.data.secret);
      setStep('scan');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to start MFA setup');
    } finally {
      setLoading(false);
    }
  };

  const verifyCode = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.post('/mfa/verify', { code });
      setRecoveryCodes(res.data.recoveryCodes);
      setStep('done');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Invalid code. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const copyRecoveryCodes = () => {
    navigator.clipboard.writeText(recoveryCodes.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-[2px] text-red-400 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}

      {step === 'init' && (
        <div className="text-center space-y-4">
          <Shield className="w-12 h-12 text-primary-400 mx-auto" />
          <p className="text-slate-300">
            Two-factor authentication adds an extra layer of security.
            You'll need an authenticator app like Google Authenticator or Authy.
          </p>
          <div className="flex gap-3 justify-center">
            <button onClick={onCancel} className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors">
              Cancel
            </button>
            <button
              onClick={startSetup}
              disabled={loading}
              className="px-6 py-2 bg-primary-600 hover:bg-primary-500 text-white rounded-[2px] font-medium transition-colors disabled:opacity-50"
            >
              {loading ? 'Setting up...' : 'Start Setup'}
            </button>
          </div>
        </div>
      )}

      {step === 'scan' && (
        <div className="space-y-4">
          <p className="text-sm text-slate-300">
            Scan this QR code with your authenticator app:
          </p>
          <div className="flex justify-center">
            <img src={qrCode} alt="TOTP QR Code" className="w-48 h-48 rounded bg-white p-2" />
          </div>
          <div className="bg-slate-900/50 rounded p-3">
            <p className="text-xs text-slate-500 mb-1">Or enter this key manually:</p>
            <code className="text-sm text-primary-400 break-all">{secret}</code>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Enter the 6-digit code from your app:</label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="w-full bg-slate-950/50 border border-slate-700 rounded-[2px] py-2.5 px-4 text-white text-center text-2xl tracking-[0.5em] focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500/50"
              placeholder="000000"
              maxLength={6}
              autoFocus
            />
          </div>
          <div className="flex gap-3 justify-end">
            <button onClick={onCancel} className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors">
              Cancel
            </button>
            <button
              onClick={verifyCode}
              disabled={loading || code.length !== 6}
              className="px-6 py-2 bg-primary-600 hover:bg-primary-500 text-white rounded-[2px] font-medium transition-colors disabled:opacity-50"
            >
              {loading ? 'Verifying...' : 'Verify & Enable'}
            </button>
          </div>
        </div>
      )}

      {step === 'done' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-emerald-400">
            <CheckCircle className="w-5 h-5" />
            <span className="font-semibold">MFA Enabled Successfully</span>
          </div>
          <p className="text-sm text-slate-300">
            Save these recovery codes in a safe place. Each code can only be used once.
          </p>
          <div className="bg-slate-900/50 border border-slate-700 rounded p-4 space-y-1">
            {recoveryCodes.map((code, i) => (
              <div key={i} className="font-mono text-sm text-white">{code}</div>
            ))}
          </div>
          <div className="flex gap-3 justify-end">
            <button
              onClick={copyRecoveryCodes}
              className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors flex items-center gap-1"
            >
              <Copy className="w-4 h-4" /> {copied ? 'Copied!' : 'Copy Codes'}
            </button>
            <button
              onClick={onComplete}
              className="px-6 py-2 bg-primary-600 hover:bg-primary-500 text-white rounded-[2px] font-medium transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MfaSetup;
