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
    if (loading) return;
    const cleanEmail = email.trim();
    const cleanPassword = password.trim();
    if (!cleanEmail || !cleanPassword) return;
    if (mode === 'login') onLogin(cleanEmail, cleanPassword);
    else onSignup(cleanEmail, cleanPassword);
  };

  return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', zIndex: 1 }}>

      <motion.div
        initial={{ opacity: 0, y: 32, scale: 0.97 }}
        animate={{ opacity: 1, y: 0,  scale: 1 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        style={{ width: '100%', maxWidth: '460px', padding: '0 18px' }}
      >
        {/* Logo / Brand */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
            SentraMessaging
          </h1>
          <p style={{ fontFamily: 'var(--font-display)', fontSize: '0.95rem', color: 'var(--text-secondary)', marginTop: '6px' }}>
            Secure messaging with local key storage.
          </p>
        </div>

        {/* Card */}
        <section className="glass" aria-label="Authentication" style={{ borderRadius: 'var(--radius-xl)', padding: '28px', border: '1px solid var(--border)' }}>
          {/* Mode Toggle */}
          <div role="tablist" aria-label="Authentication mode" style={{ display: 'flex', gap: '4px', marginBottom: '22px', background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', padding: '4px' }}>
            {(['login', 'signup'] as const).map(m => (
              <button
                key={m}
                onClick={() => setMode(m)}
                role="tab"
                aria-selected={mode === m}
                style={{
                  flex: 1, padding: '8px', border: 'none', borderRadius: '6px', cursor: 'pointer',
                  background: mode === m ? 'var(--bg-elevated)' : 'transparent',
                  color: mode === m ? 'var(--text-primary)' : 'var(--text-muted)',
                  fontFamily: 'var(--font-display)', fontSize: '0.95rem', fontWeight: 600,
                  transition: 'all 0.2s',
                  boxShadow: mode === m ? '0 1px 2px rgba(15, 23, 42, 0.12)' : 'none',
                }}
              >
                {m === 'login' ? 'Sign In' : 'Create Account'}
              </button>
            ))}
          </div>

          <form onSubmit={handle} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontFamily: 'var(--font-display)', fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>
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
              <label style={{ display: 'block', fontFamily: 'var(--font-display)', fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>
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
                  <div className="badge badge-error" role="alert" aria-live="polite" style={{ width: '100%', justifyContent: 'center', padding: '9px' }}>
                    ⚠ {error}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <button className="btn btn-primary" type="submit" disabled={loading} style={{ marginTop: '4px', minHeight: '44px', position: 'relative', overflow: 'hidden' }}>
              {loading ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ display: 'inline-block', width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.35)', borderTopColor: 'white', borderRadius: '50%', animation: 'ratchet-spin 0.7s linear infinite' }} />
                  Authenticating…
                </span>
              ) : (
                mode === 'login' ? '→ Authenticate' : '→ Initialize Identity'
              )}
            </button>
          </form>

          <div style={{ marginTop: '16px', padding: '12px', background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: '0.86rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Private keys are generated locally and never leave your device.
              Only your public key bundle is synced to the network.
            </p>
          </div>
        </section>

        {/* Key generation status */}
        <AnimatePresence>
          {loading && (
            <motion.div
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              style={{ marginTop: '16px', textAlign: 'center' }}
            >
              <p style={{ fontFamily: 'var(--font-display)', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                Generating Kyber-768 + X25519 identity…
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </main>
  );
}
