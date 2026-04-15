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
      height: '50px',
      background: 'var(--bg-base)',
      borderBottom: '1px solid var(--border)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 18px',
      flexShrink: 0,
      zIndex: 10,
      position: 'relative',
    }}>
      <span style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
        SentraMessaging
      </span>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: color }} />
        <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.9rem', fontWeight: 600, color }}>
          {streamStatus}
        </span>
        {latencyMs !== null && connected && (
          <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.88rem', color: 'var(--text-muted)' }}>
            {latencyMs} ms
          </span>
        )}
      </div>
    </div>
  );
}
