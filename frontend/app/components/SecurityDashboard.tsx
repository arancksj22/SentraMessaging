'use client';

import type { StreamStatus } from '../lib/types';

interface Props {
  streamStatus: StreamStatus;
  latencyMs: number | null;
  epoch: number;
  sessionCount: number;
}

function Check({ label }: { label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 0' }}>
      <div style={{ width: '16px', height: '16px', borderRadius: '50%', flexShrink: 0, background: 'rgba(0,230,118,0.12)', border: '1px solid rgba(0,230,118,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', color: 'var(--success)' }}>
        ✓
      </div>
      <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{label}</span>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: 'var(--text-muted)' }}>{label}</span>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: accent ? 'var(--accent)' : 'var(--text-secondary)', fontWeight: 500 }}>{value}</span>
    </div>
  );
}

export default function SecurityDashboard({ streamStatus, latencyMs, epoch, sessionCount }: Props) {
  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Security checks */}
      <div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.58rem', color: 'var(--text-muted)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '8px' }}>
          Security
        </div>
        <Check label="Zero-Knowledge" />
        <Check label="Forward Secrecy" />
        <Check label="Quantum-Resistant" />
        <Check label="AES-256-GCM" />
      </div>

      {/* Stats */}
      <div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.58rem', color: 'var(--text-muted)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '8px' }}>
          Session
        </div>
        <Stat label="stream"    value={streamStatus} accent={streamStatus === 'connected'} />
        <Stat label="latency"   value={latencyMs !== null ? `${latencyMs}ms` : '—'} accent />
        <Stat label="epoch"     value={String(epoch)} accent />
        <Stat label="sessions"  value={String(sessionCount)} />
      </div>
    </div>
  );
}
