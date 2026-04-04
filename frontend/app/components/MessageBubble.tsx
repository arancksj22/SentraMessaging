'use client';

import type { LocalMessage } from '../lib/types';

interface Props {
  message: LocalMessage;
  index: number;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function MessageBubble({ message, index }: Props) {
  const isOut = message.direction === 'outbound';

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: isOut ? 'flex-end' : 'flex-start',
        marginBottom: '12px',
        animation: 'boot-in 0.35s ease both',
        animationDelay: `${Math.min(index * 40, 400)}ms`,
      }}
    >
      <div style={{ maxWidth: '70%' }}>
        {/* Bubble */}
        <div style={{
          padding: '10px 14px',
          borderRadius: isOut ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
          background: isOut ? 'var(--accent-dim)' : 'var(--bg-elevated)',
          border: isOut ? '1px solid var(--accent-border)' : '1px solid var(--border)',
          position: 'relative',
        }}>
          <p style={{
            fontFamily: 'var(--font-display)',
            fontSize: '0.9rem',
            color: 'var(--text-primary)',
            lineHeight: 1.5,
            margin: 0,
          }}>
            {message.plaintext}
          </p>
        </div>

        {/* Metadata row */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginTop: '4px',
          justifyContent: isOut ? 'flex-end' : 'flex-start',
          flexWrap: 'wrap',
        }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.58rem', color: 'var(--text-muted)' }}>
            {formatTime(message.timestamp)}
          </span>

          {/* Epoch badge */}
          <span title={`Double Ratchet Epoch ${message.epoch}`} style={{
            fontFamily: 'var(--font-mono)', fontSize: '0.55rem',
            color: 'var(--text-muted)', letterSpacing: '0.05em',
          }}>
            ε{message.epoch}
          </span>

          {/* Encrypted preview */}
          <span
            title={`Ciphertext preview (first 8 bytes): 0x${message.ciphertextPreview}`}
            style={{
              fontFamily: 'var(--font-mono)', fontSize: '0.55rem',
              color: isOut ? 'rgba(0,245,255,0.4)' : 'var(--text-muted)',
              letterSpacing: '0.04em', cursor: 'help',
            }}
          >
            🔐 0x{message.ciphertextPreview}…
          </span>

          {/* Delivered indicator */}
          {isOut && (
            <span style={{ color: message.delivered ? 'var(--success)' : 'var(--text-muted)', fontSize: '0.65rem' }}>
              {message.delivered ? '✓✓' : '○'}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
