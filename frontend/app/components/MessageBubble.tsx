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
    <div style={{
      display: 'flex',
      justifyContent: isOut ? 'flex-end' : 'flex-start',
      marginBottom: '8px',
      animation: 'boot-in 0.3s ease both',
      animationDelay: `${Math.min(index * 30, 300)}ms`,
    }}>
      <div style={{ maxWidth: '68%' }}>
        <div style={{
          padding: '9px 14px',
          borderRadius: isOut ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
          background: isOut ? 'var(--accent-dim)' : 'var(--bg-elevated)',
          border: isOut ? '1px solid var(--accent-border)' : '1px solid var(--border)',
        }}>
          <p style={{ fontFamily: 'var(--font-display)', fontSize: '0.9rem', color: 'var(--text-primary)', lineHeight: 1.5, margin: 0 }}>
            {message.plaintext}
          </p>
        </div>

        <div style={{
          display: 'flex', alignItems: 'center', gap: '6px', marginTop: '3px',
          justifyContent: isOut ? 'flex-end' : 'flex-start',
        }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.58rem', color: 'var(--text-muted)' }}>
            {formatTime(message.timestamp)}
          </span>
          {isOut && (
            <span style={{ color: message.delivered ? 'var(--success)' : 'var(--text-muted)', fontSize: '0.62rem' }}>
              {message.delivered ? '✓✓' : '○'}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
