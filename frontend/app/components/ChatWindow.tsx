'use client';

import { useState, useRef, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import MessageBubble from './MessageBubble';
import type { LocalMessage, Contact } from '../lib/types';

interface Props {
  contact: Contact | null;
  messages: LocalMessage[];
  currentEpoch: number;
  onSend: (text: string) => void;
  onInitiateHandshake: () => void;
  sessionEstablished: boolean;
}

const avatarHue = (name: string) => (name.charCodeAt(0) * 17) % 360;

export default function ChatWindow({ contact, messages, currentEpoch, onSend, onInitiateHandshake, sessionEstablished }: Props) {
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || !contact) return;
    setInput('');
    onSend(text);
  };

  if (!contact) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '12px' }}>
        <div style={{ opacity: 0.15, animation: 'float 4s ease-in-out infinite' }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
            <path d="M12 2L4 6v6c0 5.25 3.5 10.15 8 11.35C16.5 22.15 20 17.25 20 12V6L12 2z"
              stroke="var(--accent)" strokeWidth="1" />
          </svg>
        </div>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
          Select a contact
        </p>
      </div>
    );
  }

  const hue = avatarHue(contact.displayName);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        padding: '12px 20px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg-base)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '34px', height: '34px', borderRadius: '50%',
            background: `hsl(${hue}, 55%, 22%)`,
            border: `1px solid hsl(${hue}, 50%, 32%)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 600, fontSize: '0.85rem',
            color: `hsl(${hue}, 70%, 65%)`,
            flexShrink: 0,
          }}>
            {contact.displayName[0]}
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              {contact.displayName}
              {sessionEstablished && (
                <span style={{ fontSize: '0.6rem', color: 'var(--success)', fontFamily: 'var(--font-mono)', fontWeight: 400 }}>· secured</span>
              )}
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'var(--text-muted)', marginTop: '1px' }}>
              epoch {currentEpoch}
            </div>
          </div>
        </div>

        {!sessionEstablished && (
          <button className="btn btn-ghost" onClick={onInitiateHandshake} style={{ fontSize: '0.75rem', padding: '6px 14px' }}>
            Connect
          </button>
        )}
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column' }}>
        <AnimatePresence>
          {messages.map((msg, i) => (
            <MessageBubble key={msg.id} message={msg} index={i} />
          ))}
        </AnimatePresence>
        {messages.length === 0 && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--text-muted)' }}>
              {sessionEstablished ? 'No messages yet' : 'Connect to start messaging'}
            </p>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSend} style={{
        padding: '14px 16px',
        background: 'var(--bg-base)',
        borderTop: '1px solid var(--border)',
        display: 'flex', gap: '10px', alignItems: 'center', flexShrink: 0,
      }}>
        <input
          className="input-field"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder={sessionEstablished ? 'Message…' : 'Connect first…'}
          disabled={!sessionEstablished}
        />
        <button
          className="btn btn-primary"
          type="submit"
          disabled={!input.trim() || !sessionEstablished}
          style={{ padding: '9px 14px', flexShrink: 0 }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
            <path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </form>
    </div>
  );
}
