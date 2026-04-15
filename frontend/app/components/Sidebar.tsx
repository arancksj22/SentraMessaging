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

const avatarHue = (name: string) => (name.charCodeAt(0) * 17) % 360;

export default function Sidebar({ contacts, activeContactId, onSelectContact, onNewChat, userEmail }: Props) {
  return (
    <div style={{
      width: '260px', flexShrink: 0,
      background: 'var(--bg-base)',
      borderRight: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column',
      height: '100%', overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{ padding: '16px 16px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
          Messages
        </span>
        <button
          onClick={onNewChat}
          style={{
            background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
            cursor: 'pointer', padding: '4px 8px', color: 'var(--text-muted)',
            display: 'flex', alignItems: 'center', gap: '4px', transition: 'all 0.15s',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-accent)'; (e.currentTarget as HTMLElement).style.color = 'var(--accent)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)';        (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; }}
          title="New conversation"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
            <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* Contact list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 8px' }}>
        {contacts.map((contact, i) => {
          const hue = avatarHue(contact.displayName);
          const isActive = activeContactId === contact.userId;
          return (
            <motion.button
              key={contact.userId}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05, duration: 0.25 }}
              onClick={() => onSelectContact(contact)}
              style={{
                width: '100%', padding: '10px 10px',
                background: isActive ? 'var(--bg-elevated)' : 'transparent',
                border: isActive ? '1px solid var(--border-accent)' : '1px solid transparent',
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer', textAlign: 'left', marginBottom: '2px',
                transition: 'all 0.15s',
                boxShadow: isActive ? 'inset 0 0 20px var(--accent-dim)' : 'none',
              }}
              onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'var(--bg-surface)'; }}
              onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0,
                  background: `hsl(${hue}, 55%, 22%)`,
                  border: `1px solid hsl(${hue}, 50%, 32%)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 600, fontSize: '0.82rem',
                  color: `hsl(${hue}, 70%, 65%)`,
                }}>
                  {contact.displayName[0]}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {contact.displayName}
                    </span>
                    {contact.sessionEstablished && (
                      <span style={{ color: 'var(--success)', fontSize: '11px', flexShrink: 0, marginLeft: '4px' }}>🔒</span>
                    )}
                  </div>
                  {contact.lastMessage ? (
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'var(--text-muted)', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {contact.lastMessage.direction === 'outbound' ? 'You: ' : ''}{contact.lastMessage.plaintext.slice(0, 28)}
                    </div>
                  ) : (
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      {contact.sessionEstablished ? 'No messages' : 'No session'}
                    </div>
                  )}
                </div>
              </div>
            </motion.button>
          );
        })}

        {contacts.length === 0 && (
          <div style={{ padding: '32px 12px', textAlign: 'center' }}>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--text-muted)' }}>No contacts yet</p>
          </div>
        )}
      </div>

      {/* User footer */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {userEmail}
        </div>
      </div>
    </div>
  );
}
