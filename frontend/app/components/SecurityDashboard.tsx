'use client';

import type { StreamStatus } from '../lib/types';

interface Props {
  streamStatus: StreamStatus;
  latencyMs: number | null;
  epoch: number;
  sessionCount: number;
}

interface StatRowProps {
  label: string;
  value: string;
  accent?: boolean;
  success?: boolean;
  pq?: boolean;
}

function StatRow({ label, value, accent, success, pq }: StatRowProps) {
  const color = success ? 'var(--success)' : accent ? 'var(--accent)' : pq ? 'var(--pq-badge)' : 'var(--text-secondary)';
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>{label}</span>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color, fontWeight: 500 }}>{value}</span>
    </div>
  );
}

function SecurityCheck({ label, subtitle }: { label: string; subtitle: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '10px', background: 'var(--bg-void)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', marginBottom: '6px' }}>
      <div style={{
        width: '20px', height: '20px', borderRadius: '50%', flexShrink: 0,
        background: 'rgba(0,230,118,0.12)', border: '1px solid rgba(0,230,118,0.3)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '10px',
      }}>
        ✓
      </div>
      <div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: '0.8rem', fontWeight: 500, color: 'var(--success)' }}>{label}</div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'var(--text-muted)', marginTop: '2px' }}>{subtitle}</div>
      </div>
    </div>
  );
}

export default function SecurityDashboard({ streamStatus, latencyMs, epoch, sessionCount }: Props) {
  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Security posture */}
      <div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'var(--text-muted)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '10px' }}>
          Security Posture
        </div>
        <SecurityCheck label="Zero-Knowledge" subtitle="Encryption before Envoy Proxy" />
        <SecurityCheck label="Forward Secrecy" subtitle="Double Ratchet active" />
        <SecurityCheck label="Quantum-Resistant" subtitle="PQXDH · Kyber-768 KEM" />
        <SecurityCheck label="Integrity" subtitle="AES-256-GCM authenticated" />
      </div>

      {/* Session stats */}
      <div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'var(--text-muted)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '10px' }}>
          Session Telemetry
        </div>
        <StatRow label="STREAM"     value={streamStatus.toUpperCase()} success={streamStatus === 'connected'} />
        <StatRow label="LATENCY"    value={latencyMs !== null ? `${latencyMs}ms` : '—'} accent />
        <StatRow label="EPOCH"      value={String(epoch).padStart(4, '0')} accent />
        <StatRow label="SESSIONS"   value={String(sessionCount)} />
        <StatRow label="ALGORITHM"  value="PQXDH" pq />
        <StatRow label="KEM"        value="Kyber-768" pq />
        <StatRow label="CLASSICAL"  value="X25519" accent />
        <StatRow label="CIPHER"     value="AES-256-GCM" accent />
        <StatRow label="KDF"        value="HKDF-SHA256" />
        <StatRow label="RATCHET"    value="Double Ratchet" />
      </div>

      {/* Threat model */}
      <div style={{ padding: '12px', background: 'var(--bg-void)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'var(--accent)', marginBottom: '8px', letterSpacing: '0.08em' }}>
          // THREAT MODEL
        </div>
        {[
          ['Quantum HNDL', 'MITIGATED', true],
          ['MITM', 'MITIGATED', true],
          ['Key Compromise', 'FORWARD SECURE', true],
          ['Server Breach', 'ZERO KNOWLEDGE', true],
        ].map(([threat, status, ok]) => (
          <div key={threat as string} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'var(--text-muted)' }}>{threat as string}</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: ok ? 'var(--success)' : 'var(--error)', fontWeight: 600 }}>{status as string}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
