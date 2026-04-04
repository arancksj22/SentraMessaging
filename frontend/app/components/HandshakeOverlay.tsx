'use client';

import { motion, AnimatePresence } from 'framer-motion';
import type { HandshakeStatus } from '../lib/types';

interface Props {
  isOpen: boolean;
  targetName: string;
  status: HandshakeStatus;
  onClose: () => void;
}

const STEPS: { key: HandshakeStatus; label: string; detail: string }[] = [
  { key: 'fetching_bundle', label: 'Fetch Pre-Key Bundle',    detail: 'Retrieving X25519 + Kyber-768 public keys from Supabase' },
  { key: 'x25519_dh',       label: 'X25519 Diffie-Hellman',  detail: 'Computing classical elliptic-curve shared secret' },
  { key: 'kyber_encapsulate', label: 'Kyber-768 Encapsulate', detail: 'Post-quantum KEM — generating ciphertext and shared secret' },
  { key: 'hkdf_derive',      label: 'HKDF Key Derivation',   detail: 'Combining DH + KEM outputs via SHA-256 HKDF → 256-bit session key' },
  { key: 'established',      label: 'Session Established',   detail: 'Double Ratchet initialized — forward secrecy active' },
];

const statusOrder = ['fetching_bundle', 'x25519_dh', 'kyber_encapsulate', 'hkdf_derive', 'established'];

function getStepState(stepKey: HandshakeStatus, currentStatus: HandshakeStatus): 'done' | 'active' | 'pending' | 'error' {
  if (currentStatus === 'error') return 'error';
  const stepIdx    = statusOrder.indexOf(stepKey);
  const currentIdx = statusOrder.indexOf(currentStatus);
  if (currentIdx === -1) return 'pending';
  if (stepIdx < currentIdx)  return 'done';
  if (stepIdx === currentIdx) return 'active';
  return 'pending';
}

export default function HandshakeOverlay({ isOpen, targetName, status, onClose }: Props) {
  const isComplete = status === 'established';
  const isError    = status === 'error';

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          style={{
            position: 'fixed', inset: 0, zIndex: 50,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(8,11,13,0.85)',
            backdropFilter: 'blur(12px)',
          }}
          onClick={isComplete || isError ? onClose : undefined}
        >
          <motion.div
            initial={{ scale: 0.92, y: 24 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 12 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: '480px',
              background: 'var(--bg-surface)',
              border: isComplete ? '1px solid rgba(0,230,118,0.3)' : isError ? '1px solid rgba(255,68,68,0.3)' : '1px solid var(--border-accent)',
              borderRadius: 'var(--radius-xl)',
              padding: '32px',
              boxShadow: isComplete
                ? '0 0 40px rgba(0,230,118,0.15)'
                : '0 0 40px rgba(0,245,255,0.1)',
            }}
          >
            {/* Header */}
            <div style={{ textAlign: 'center', marginBottom: '28px' }}>
              <div style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: '52px', height: '52px', borderRadius: '14px', marginBottom: '14px',
                background: isComplete ? 'rgba(0,230,118,0.12)' : 'var(--accent-dim)',
                border: isComplete ? '1px solid rgba(0,230,118,0.3)' : '1px solid var(--accent-border)',
                animation: isComplete ? 'none' : 'pulse-accent 2s ease-in-out infinite',
              }}>
                {isComplete ? (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <path d="M12 2L4 6v6c0 5.25 3.5 10.15 8 11.35C16.5 22.15 20 17.25 20 12V6L12 2z"
                      stroke="var(--success)" strokeWidth="1.5" fill="rgba(0,230,118,0.1)" />
                    <path d="M9 12l2 2 4-4" stroke="var(--success)" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                ) : (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" style={{ animation: 'ratchet-spin 2s linear infinite' }}>
                    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"
                      stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                )}
              </div>
              <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.1rem', color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
                {isComplete ? 'PQXDH Complete' : 'PQXDH Handshake'}
              </h2>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                {isComplete ? `Secure session established with ${targetName}` : `Initiating with ${targetName}…`}
              </p>
            </div>

            {/* Steps */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '24px' }}>
              {STEPS.map((step, i) => {
                const state = getStepState(step.key, status);
                return (
                  <motion.div
                    key={step.key}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.07 }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px',
                      background: state === 'active' ? 'var(--accent-dim)' : state === 'done' ? 'rgba(0,230,118,0.05)' : 'var(--bg-void)',
                      border: state === 'active' ? '1px solid var(--accent-border)' : state === 'done' ? '1px solid rgba(0,230,118,0.15)' : '1px solid var(--border)',
                      borderRadius: 'var(--radius-md)',
                      transition: 'all 0.3s var(--ease-out)',
                    }}
                  >
                    {/* Step indicator */}
                    <div style={{
                      width: '22px', height: '22px', borderRadius: '50%', flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px',
                      background: state === 'done' ? 'var(--success)' : state === 'active' ? 'var(--accent)' : 'var(--bg-elevated)',
                      color: state === 'done' || state === 'active' ? 'var(--bg-void)' : 'var(--text-muted)',
                      fontFamily: 'var(--font-mono)', fontWeight: 700,
                      animation: state === 'active' ? 'pulse-accent 1.5s ease-in-out infinite' : 'none',
                    }}>
                      {state === 'done' ? '✓' : state === 'active' ? '→' : i + 1}
                    </div>

                    <div style={{ flex: 1 }}>
                      <div style={{ fontFamily: 'var(--font-display)', fontSize: '0.82rem', fontWeight: 500, color: state === 'pending' ? 'var(--text-muted)' : 'var(--text-primary)' }}>
                        {step.label}
                      </div>
                      {(state === 'active' || state === 'done') && (
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                          {step.detail}
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* Footer */}
            {(isComplete || isError) && (
              <button className="btn btn-primary" style={{ width: '100%' }} onClick={onClose}>
                {isComplete ? '→ Begin Encrypted Session' : '× Close'}
              </button>
            )}

            {!isComplete && !isError && (
              <div style={{ textAlign: 'center' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: 'var(--text-muted)' }}>
                  Running in Web Worker · UI thread unblocked
                </span>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
