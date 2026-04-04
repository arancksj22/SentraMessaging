'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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

export default function ChatWindow({ contact, messages, currentEpoch, onSend, onInitiateHandshake, sessionEstablished }: Props) {
  const [input, setInput] = useState('');
  const [prevEpoch, setPrevEpoch] = useState(currentEpoch);
  const [ratchetFlash, setRatchetFlash] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Detect ratchet advance → trigger glitch animation
  useEffect(() => {
    if (currentEpoch !== prevEpoch) {
      setPrevEpoch(currentEpoch);
      setRatchetFlash(true);
      setTimeout(() => setRatchetFlash(false), 900);
    }
  }, [currentEpoch, prevEpoch]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || !contact) return;
    setInput('');
    onSend(text);
  };

  if (!contact) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '16px' }}>
        <div style={{ opacity: 0.2, animation: 'float 4s ease-in-out infinite' }}>
          <svg width="56" height="56" viewBox="0 0 24 24" fill="none">
            <path d="M12 2L4 6v6c0 5.25 3.5 10.15 8 11.35C16.5 22.15 20 17.25 20 12V6L12 2z"
              stroke="var(--accent)" strokeWidth="1" fill="none" />
          </svg>
        </div>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          Select a contact to begin a secure session
        </p>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Chat Header */}
      <div style={{
        padding: '12px 20px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg-base)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '36px', height: '36px', borderRadius: '50%',
            background: `hsl(${(contact.displayName.charCodeAt(0) * 17) % 360}, 60%, 25%)`,
            border: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 600, fontSize: '0.85rem',
            color: `hsl(${(contact.displayName.charCodeAt(0) * 17) % 360}, 80%, 70%)`,
          }}>
            {contact.displayName[0]}
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>{contact.displayName}</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'var(--text-muted)' }}>{contact.email}</div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Ratchet epoch — glitch on rotate */}
          <div style={{ position: 'relative' }}>
            <span
              className={`badge badge-accent`}
              style={{ position: 'relative', overflow: 'hidden' }}
            >
              {ratchetFlash && <span style={{
                position: 'absolute', inset: 0,
                background: 'var(--accent)', opacity: 0.3,
                animation: 'fade-in 0.1s ease',
              }} />}
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" style={{ animation: ratchetFlash ? 'ratchet-spin 0.4s ease' : 'none' }}>
                <path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8"
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              EPOCH {currentEpoch}
            </span>
            {ratchetFlash && (
              <motion.div
                initial={{ opacity: 1, y: -20 }} animate={{ opacity: 0, y: -40 }}
                transition={{ duration: 0.8 }}
                style={{
                  position: 'absolute', top: '-24px', left: '50%', transform: 'translateX(-50%)',
                  fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'var(--success)', whiteSpace: 'nowrap',
                }}
              >
                ↻ KEY ROTATED
              </motion.div>
            )}
          </div>

          {sessionEstablished ? (
            <span className="badge badge-success">🔒 PQ-SECURE</span>
          ) : (
            <button className="btn btn-ghost" onClick={onInitiateHandshake} style={{ fontSize: '0.75rem', padding: '5px 12px' }}>
              Initiate PQXDH
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column' }}>
        <AnimatePresence>
          {messages.map((msg, i) => (
            <MessageBubble key={msg.id} message={msg} index={i} />
          ))}
        </AnimatePresence>
        {messages.length === 0 && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', opacity: 0.5 }}>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              Session established. Messages are encrypted before sending.
            </p>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Encryption indicator */}
      <div style={{
        padding: '6px 20px',
        background: 'var(--bg-void)',
        borderTop: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: '8px',
        flexShrink: 0,
      }}>
        <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent)', animation: 'pulse-accent 2s ease-in-out infinite' }} />
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
          AES-256-GCM · Encrypted before leaving browser · Epoch {currentEpoch}
        </span>
      </div>

      {/* Input */}
      <form onSubmit={handleSend} style={{
        padding: '12px 16px',
        background: 'var(--bg-base)',
        borderTop: '1px solid var(--border)',
        display: 'flex', gap: '10px', alignItems: 'center', flexShrink: 0,
      }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <input
            className="input-field"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder={sessionEstablished ? 'Type a message — encrypted locally before sending…' : 'Start a PQXDH handshake first…'}
            disabled={!sessionEstablished}
            style={{ paddingRight: '40px' }}
          />
          {/* Local plaintext indicator */}
          <span style={{
            position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
            fontFamily: 'var(--font-mono)', fontSize: '0.55rem', color: 'var(--accent)', opacity: 0.7,
          }}>
            LOCAL
          </span>
        </div>
        <button
          className="btn btn-primary"
          type="submit"
          disabled={!input.trim() || !sessionEstablished}
          style={{ padding: '9px 16px', flexShrink: 0 }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </form>
    </div>
  );
}
