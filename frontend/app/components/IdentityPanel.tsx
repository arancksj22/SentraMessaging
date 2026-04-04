'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Props {
  x25519PubKey: string | null;
  kyberPubKey: string | null;
  keyStatus: string;
  userId: string;
}

function truncate(s: string, n = 40) { return s.length > n ? s.slice(0, n) + '…' : s; }
function toHex(b64: string) {
  try {
    return Array.from(atob(b64), c => c.charCodeAt(0).toString(16).padStart(2, '0')).join('').toUpperCase().slice(0, 64);
  } catch { return b64.slice(0, 64); }
}

export default function IdentityPanel({ x25519PubKey, kyberPubKey, keyStatus, userId }: Props) {
  const [copied, setCopied] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const copy = async (label: string, value: string) => {
    await navigator.clipboard.writeText(value);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  const statusColor = keyStatus === 'ready' ? 'var(--success)' : keyStatus === 'error' ? 'var(--error)' : 'var(--warning)';

  return (
    <div style={{
      borderBottom: '1px solid var(--border)',
      padding: '16px',
    }}>
      <button
        onClick={() => setExpanded(e => !e)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginBottom: expanded ? '14px' : 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
            <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"
              stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            Identity Bundle
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: statusColor }}>
            {keyStatus.toUpperCase()}
          </span>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s', color: 'var(--text-muted)' }}>
            <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            style={{ overflow: 'hidden' }}
          >
            {/* User ID */}
            <div style={{ marginBottom: '12px' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.58rem', color: 'var(--text-muted)', marginBottom: '4px', letterSpacing: '0.08em' }}>USER ID</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text-secondary)', wordBreak: 'break-all' }}>{userId}</div>
            </div>

            {/* X25519 key */}
            {x25519PubKey && (
              <div style={{ marginBottom: '12px', padding: '10px', background: 'var(--bg-void)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span className="badge badge-accent" style={{ fontSize: '0.55rem' }}>CLASSICAL · X25519</span>
                  <button
                    onClick={() => copy('x25519', x25519PubKey)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: copied === 'x25519' ? 'var(--success)' : 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '0.6rem' }}
                  >
                    {copied === 'x25519' ? '✓ COPIED' : 'COPY'}
                  </button>
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: 'var(--text-secondary)', wordBreak: 'break-all', letterSpacing: '0.03em' }}>
                  {toHex(x25519PubKey)}…
                </div>
              </div>
            )}

            {/* Kyber key */}
            {kyberPubKey && (
              <div style={{ marginBottom: '12px', padding: '10px', background: 'var(--bg-void)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(167,139,250,0.2)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span className="badge badge-pq" style={{ fontSize: '0.55rem' }}>POST-QUANTUM · KYBER-768</span>
                  <button
                    onClick={() => copy('kyber', kyberPubKey)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: copied === 'kyber' ? 'var(--success)' : 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '0.6rem' }}
                  >
                    {copied === 'kyber' ? '✓ COPIED' : 'COPY'}
                  </button>
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: 'var(--text-secondary)', wordBreak: 'break-all', letterSpacing: '0.03em' }}>
                  {toHex(kyberPubKey)}…
                </div>
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
                <path d="M12 2L4 6v6c0 5.25 3.5 10.15 8 11.35C16.5 22.15 20 17.25 20 12V6L12 2z"
                  stroke="var(--success)" strokeWidth="1.5" fill="rgba(0,230,118,0.1)" />
              </svg>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.58rem', color: 'var(--text-muted)' }}>
                Bundle synced to Supabase ∷ Private keys: IndexedDB only
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
