'use client';

import { motion, AnimatePresence } from 'framer-motion';
import type { StreamStatus, HandshakeStatus } from '../lib/types';

interface Props {
  streamStatus: StreamStatus;
  latencyMs: number | null;
  handshakeStatus: HandshakeStatus;
  epoch: number;
  userEmail: string;
}

const streamColors: Record<StreamStatus, string> = {
  connected:    'var(--success)',
  connecting:   'var(--warning)',
  reconnecting: 'var(--warning)',
  disconnected: 'var(--text-muted)',
  error:        'var(--error)',
};

const handshakeLabels: Record<HandshakeStatus, string> = {
  idle:              'IDLE',
  fetching_bundle:   'FETCHING BUNDLE',
  x25519_dh:         'X25519 DH',
  kyber_encapsulate: 'KYBER-768 KEM',
  hkdf_derive:       'HKDF DERIVE',
  established:       'ESTABLISHED',
  error:             'ERROR',
};

export default function StatusBar({ streamStatus, latencyMs, handshakeStatus, epoch, userEmail }: Props) {
  const streamColor = streamColors[streamStatus];

  return (
    <div style={{
      height: '44px',
      background: 'var(--bg-base)',
      borderBottom: '1px solid var(--border)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 20px',
      position: 'relative',
      zIndex: 10,
      flexShrink: 0,
    }}>
      {/* Left: Brand */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: '0.7rem', fontWeight: 600,
          color: 'var(--accent)', letterSpacing: '0.15em',
        }}>
          SENTRA∷CORE
        </span>
        <div style={{ width: '1px', height: '16px', background: 'var(--border)' }} />
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text-muted)', letterSpacing: '0.04em' }}>
          {userEmail}
        </span>
      </div>

      {/* Center: Handshake status */}
      <AnimatePresence mode="wait">
        <motion.div
          key={handshakeStatus}
          initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }}
          transition={{ duration: 0.2 }}
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'var(--text-muted)', letterSpacing: '0.08em' }}>
            HANDSHAKE:
          </span>
          <span className={`badge ${handshakeStatus === 'established' ? 'badge-success' : handshakeStatus === 'error' ? 'badge-error' : 'badge-accent'}`}>
            {handshakeStatus !== 'idle' && handshakeStatus !== 'established' && (
              <span style={{ display: 'inline-block', width: '8px', height: '8px', border: '1.5px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%', animation: 'ratchet-spin 0.8s linear infinite' }} />
            )}
            {handshakeLabels[handshakeStatus]}
          </span>
        </motion.div>
      </AnimatePresence>

      {/* Right: Stream + Epoch */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        {/* Epoch counter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'var(--text-muted)', letterSpacing: '0.08em' }}>EPOCH</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-accent)' }}>
            {String(epoch).padStart(4, '0')}
          </span>
        </div>

        <div style={{ width: '1px', height: '16px', background: 'var(--border)' }} />

        {/* Stream status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div className={`pulse-dot ${streamStatus === 'connected' ? '' : streamStatus === 'error' ? 'warning' : 'offline'}`}
            style={{ background: streamColor }} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: streamColor, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            {streamStatus}
          </span>
          {latencyMs !== null && streamStatus === 'connected' && (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: 'var(--text-muted)' }}>
              {latencyMs}ms
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
