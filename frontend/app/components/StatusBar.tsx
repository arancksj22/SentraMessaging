'use client';

import type { StreamStatus } from '../lib/types';

interface Props {
  streamStatus: StreamStatus;
  latencyMs: number | null;
}

export default function StatusBar({ streamStatus, latencyMs }: Props) {
  const connected = streamStatus === 'connected';
  const color = connected ? 'var(--success)' : streamStatus === 'error' ? 'var(--error)' : 'var(--text-muted)';

  return (
    <div style={{
      height: '44px',
      background: 'var(--bg-base)',
      borderBottom: '1px solid var(--border)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 20px',
      flexShrink: 0,
      zIndex: 10,
      position: 'relative',
    }}>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', fontWeight: 600, color: 'var(--accent)', letterSpacing: '0.12em' }}>
        SENTRA∷CORE
      </span>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: color, boxShadow: connected ? `0 0 6px ${color}` : 'none' }} />
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          {streamStatus}
        </span>
        {latencyMs !== null && connected && (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: 'var(--text-muted)' }}>
            · {latencyMs}ms
          </span>
        )}
      </div>
    </div>
  );
}
