'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Props {
  onLogin:  (email: string, password: string) => void;
  onSignup: (email: string, password: string) => void;
  loading: boolean;
  error: string | null;
}

export default function AuthScreen({ onLogin, onSignup, loading, error }: Props) {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');

  const handle = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'login') onLogin(email, password);
    else onSignup(email, password);
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', zIndex: 1 }}>
      {/* Scan line effect */}
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 0,
      }}>
        <div style={{
          position: 'absolute', left: 0, right: 0, height: '2px',
          background: 'linear-gradient(90deg, transparent, var(--accent), transparent)',
          opacity: 0.4, animation: 'scan 6s linear infinite',
        }} />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 32, scale: 0.97 }}
        animate={{ opacity: 1, y: 0,  scale: 1 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        style={{ width: '100%', maxWidth: '420px', padding: '0 16px' }}
      >
        {/* Logo / Brand */}
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 56, height: 56, borderRadius: '14px',
            background: 'var(--accent-dim)', border: '1px solid var(--accent-border)',
            marginBottom: '16px', animation: 'float 4s ease-in-out infinite',
          }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L4 6v6c0 5.25 3.5 10.15 8 11.35C16.5 22.15 20 17.25 20 12V6L12 2z"
                stroke="var(--accent)" strokeWidth="1.5" strokeLinejoin="round" fill="none" />
              <path d="M9 12l2 2 4-4" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.75rem', fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--text-primary)' }}>
            SentraMessaging
          </h1>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px', letterSpacing: '0.1em' }}>
            POST-QUANTUM · ZERO-KNOWLEDGE · END-TO-END
          </p>
        </div>

        {/* Card */}
        <div className="glass" style={{ borderRadius: 'var(--radius-xl)', padding: '32px', border: '1px solid var(--border)' }}>
          {/* Mode Toggle */}
          <div style={{ display: 'flex', gap: '4px', marginBottom: '28px', background: 'var(--bg-void)', borderRadius: 'var(--radius-md)', padding: '4px' }}>
            {(['login', 'signup'] as const).map(m => (
              <button
                key={m}
                onClick={() => setMode(m)}
                style={{
                  flex: 1, padding: '8px', border: 'none', borderRadius: '6px', cursor: 'pointer',
                  background: mode === m ? 'var(--bg-elevated)' : 'transparent',
                  color: mode === m ? 'var(--text-primary)' : 'var(--text-muted)',
                  fontFamily: 'var(--font-display)', fontSize: '0.875rem', fontWeight: 500,
                  transition: 'all 0.2s',
                  boxShadow: mode === m ? '0 1px 4px rgba(0,0,0,0.4)' : 'none',
                }}
              >
                {m === 'login' ? 'Sign In' : 'Create Account'}
              </button>
            ))}
          </div>

          <form onSubmit={handle} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: '6px', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                Identity (Email)
              </label>
              <input
                className="input-field"
                type="email" required autoComplete="email"
                placeholder="alice@domain.com"
                value={email} onChange={e => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: '6px', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                Passphrase
              </label>
              <input
                className="input-field"
                type="password" required autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                placeholder="••••••••••••"
                value={password} onChange={e => setPassword(e.target.value)}
              />
            </div>

            <AnimatePresence>
              {error && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                  <div className="badge badge-error" style={{ width: '100%', justifyContent: 'center', padding: '8px' }}>
                    ⚠ {error}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <button className="btn btn-primary" type="submit" disabled={loading} style={{ marginTop: '4px', position: 'relative', overflow: 'hidden' }}>
              {loading ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ display: 'inline-block', width: '14px', height: '14px', border: '2px solid rgba(0,0,0,0.3)', borderTopColor: 'var(--bg-void)', borderRadius: '50%', animation: 'ratchet-spin 0.7s linear infinite' }} />
                  Authenticating…
                </span>
              ) : (
                mode === 'login' ? '→ Authenticate' : '→ Initialize Identity'
              )}
            </button>
          </form>

          <div style={{ marginTop: '20px', padding: '12px', background: 'var(--bg-void)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: 'var(--text-muted)', lineHeight: 1.6, letterSpacing: '0.02em' }}>
              <span style={{ color: 'var(--accent)' }}>// </span>
              Private keys are generated locally and never leave your device.
              Only your public key bundle is synced to the network.
            </p>
          </div>
        </div>

        {/* Key generation status */}
        <AnimatePresence>
          {loading && (
            <motion.div
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              style={{ marginTop: '16px', textAlign: 'center' }}
            >
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                Generating Kyber-768 + X25519 identity…
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
