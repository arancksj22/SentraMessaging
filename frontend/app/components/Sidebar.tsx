'use client';

import { motion } from 'framer-motion';
import type { Contact } from '../lib/types';

interface Props {
  contacts: Contact[];
  activeContactId: string | null;
  currentUserId: string;
  onSelectContact: (contact: Contact) => void;
  onNewChat: () => void;
  userEmail: string;
  x25519PubKey: string | null;
}

export default function Sidebar({ contacts, activeContactId, onSelectContact, onNewChat, userEmail, x25519PubKey }: Props) {
  const shortKey = x25519PubKey ? btoa(x25519PubKey).slice(0, 16) : null;

  return (
    <div style={{
      width: '268px', flexShrink: 0,
      background: 'var(--bg-base)',
      borderRight: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column',
      height: '100%', overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{ padding: '16px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            Conversations
          </span>
          <button
            onClick={onNewChat}
            className="btn btn-ghost"
            style={{ padding: '4px 10px', fontSize: '0.75rem', gap: '4px' }}
            title="New PQXDH Handshake"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
              <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            New
          </button>
        </div>
      </div>

      {/* Contact list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
        {contacts.map((contact, i) => (
          <motion.button
            key={contact.userId}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.06, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            onClick={() => onSelectContact(contact)}
            style={{
              width: '100%', padding: '10px 12px',
              background: activeContactId === contact.userId ? 'var(--bg-elevated)' : 'transparent',
              border: activeContactId === contact.userId ? '1px solid var(--border-accent)' : '1px solid transparent',
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer', textAlign: 'left', marginBottom: '2px',
              transition: 'all 0.18s',
              boxShadow: activeContactId === contact.userId ? '0 0 12px var(--accent-dim)' : 'none',
            }}
            onMouseEnter={e => { if (activeContactId !== contact.userId) (e.currentTarget as HTMLElement).style.background = 'var(--bg-surface)'; }}
            onMouseLeave={e => { if (activeContactId !== contact.userId) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {/* Avatar */}
              <div style={{
                width: '34px', height: '34px', borderRadius: '50%', flexShrink: 0,
                background: `hsl(${(contact.displayName.charCodeAt(0) * 17) % 360}, 60%, 25%)`,
                border: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '0.8rem',
                color: `hsl(${(contact.displayName.charCodeAt(0) * 17) % 360}, 80%, 70%)`,
              }}>
                {contact.displayName[0]}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {contact.displayName}
                  </span>
                  {contact.sessionEstablished && (
                    <span style={{ fontSize: '10px', marginLeft: '4px', color: 'var(--success)', flexShrink: 0 }}>🔒</span>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                  {contact.sessionEstablished ? (
                    <span className="badge badge-success" style={{ fontSize: '0.55rem', padding: '1px 5px' }}>PQ-SAFE</span>
                  ) : (
                    <span className="badge badge-pq" style={{ fontSize: '0.55rem', padding: '1px 5px' }}>NO SESSION</span>
                  )}
                  {contact.lastMessage && (
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100px' }}>
                      {contact.lastMessage.direction === 'outbound' ? 'You: ' : ''}{contact.lastMessage.plaintext.slice(0, 20)}…
                    </span>
                  )}
                </div>
              </div>
            </div>
          </motion.button>
        ))}

        {contacts.length === 0 && (
          <div style={{ padding: '24px 12px', textAlign: 'center' }}>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              No contacts yet.<br />Start a new PQXDH session.
            </p>
          </div>
        )}
      </div>

      {/* Identity footer */}
      <div style={{ padding: '12px', borderTop: '1px solid var(--border)', background: 'var(--bg-void)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: 'var(--accent-dim)', border: '1px solid var(--accent-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="8" r="4" stroke="var(--accent)" strokeWidth="1.5" />
              <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '0.8rem', color: 'var(--text-primary)', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {userEmail}
            </div>
            {shortKey && (
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'var(--text-muted)' }}>
                {shortKey}…
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
