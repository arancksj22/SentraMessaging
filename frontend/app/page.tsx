'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useAuth }      from './hooks/useAuth';
import { useCrypto }    from './hooks/useCrypto';
import { useMessaging } from './hooks/useMessaging';
import AuthScreen        from './components/AuthScreen';
import StatusBar         from './components/StatusBar';
import Sidebar           from './components/Sidebar';
import ChatWindow        from './components/ChatWindow';
import SecurityDashboard from './components/SecurityDashboard';
import IdentityPanel     from './components/IdentityPanel';
import HandshakeOverlay  from './components/HandshakeOverlay';
import type { Contact }  from './lib/types';

export default function App() {
  const auth      = useAuth();
  const crypto    = useCrypto(auth.user);
  const messaging = useMessaging(auth.user, crypto);

  const [activeContact, setActiveContact] = useState<Contact | null>(null);
  const [showHandshake, setShowHandshake] = useState(false);

  // ── Loading / key-generation screen ────────────────────────────────────
  if (auth.loading || auth.keyStatus === 'generating' || auth.keyStatus === 'uploading') {
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '24px', position: 'relative', zIndex: 1 }}>
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          style={{ width: 48, height: 48, borderRadius: '50%', border: '2px solid var(--border)', borderTopColor: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        />
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', color: 'var(--text-primary)', marginBottom: '6px' }}>
            {auth.keyStatus === 'generating' ? 'Generating Post-Quantum Identity…' :
             auth.keyStatus === 'uploading'  ? 'Uploading Public Key Bundle…' :
             'Initializing CipherCore…'}
          </h2>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--text-muted)' }}>
            {auth.keyStatus === 'generating' ? 'Kyber-768 + X25519 keygen in Web Worker' :
             auth.keyStatus === 'uploading'  ? 'Private keys stay in IndexedDB · Public bundle → Supabase' :
             'Loading…'}
          </p>
        </div>

        {/* Boot-progress steps */}
        {(auth.keyStatus === 'generating' || auth.keyStatus === 'uploading') && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '300px' }}>
            {[
              { label: 'X25519 keypair',  done: true },
              { label: 'Kyber-768 keypair', done: auth.keyStatus === 'uploading' },
              { label: 'Uploading public bundle', done: false, active: auth.keyStatus === 'uploading' },
            ].map(step => (
              <div key={step.label} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '16px', height: '16px', borderRadius: '50%', flexShrink: 0, background: step.done ? 'var(--success)' : 'var(--bg-elevated)', border: '1px solid ' + (step.done ? 'var(--success)' : 'var(--border)'), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px', color: 'var(--bg-void)' }}>
                  {step.done ? '✓' : step.active ? '…' : ''}
                </div>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: step.done ? 'var(--success)' : 'var(--text-muted)' }}>
                  {step.label}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── Auth screen ─────────────────────────────────────────────────────────
  if (!auth.user) {
    return (
      <AuthScreen
        onLogin={auth.login}
        onSignup={auth.signup}
        loading={auth.loading}
        error={auth.error}
      />
    );
  }

  // ── Main app ────────────────────────────────────────────────────────────
  // convId used locally in handlers below

  const handleSelectContact = async (contact: Contact) => {
    setActiveContact(contact);
    const id = [auth.user!.id, contact.userId].sort().join(':');
    await messaging.loadConversation(id);
  };

  const handleInitiateHandshake = async () => {
    if (!activeContact) return;
    setShowHandshake(true);
    await crypto.initiateHandshake(activeContact.userId);
    messaging.setContacts(prev => prev.map(c => c.userId === activeContact.userId ? { ...c, sessionEstablished: true } : c));
  };

  const handleNewChat = () => {
    setShowHandshake(false);
    setActiveContact(null);
    // In production: open a contact search / add dialog
  };

  return (
    <div className="app-root">
      {/* Status bar */}
      <StatusBar
        streamStatus={messaging.streamStatus}
        latencyMs={messaging.latencyMs}
        handshakeStatus={crypto.handshakeStatus}
        epoch={crypto.currentEpoch}
        userEmail={auth.user.email ?? auth.user.id}
      />

      {/* Main layout */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative', zIndex: 1 }}>
        {/* Sidebar */}
        <Sidebar
          contacts={messaging.contacts}
          activeContactId={activeContact?.userId ?? null}
          currentUserId={auth.user.id}
          onSelectContact={handleSelectContact}
          onNewChat={handleNewChat}
          userEmail={auth.user.email ?? ''}
          x25519PubKey={auth.x25519PubKey}
        />

        {/* Chat window */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg-void)' }}>
          <ChatWindow
            contact={activeContact}
            messages={messaging.messages}
            currentEpoch={crypto.currentEpoch}
            onSend={text => activeContact && messaging.sendMessage(text, activeContact.userId)}
            onInitiateHandshake={handleInitiateHandshake}
            sessionEstablished={activeContact?.sessionEstablished ?? false}
          />
        </div>

        {/* Right panel: Identity + Security Dashboard */}
        <div style={{
          width: '280px', flexShrink: 0,
          background: 'var(--bg-base)',
          borderLeft: '1px solid var(--border)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'var(--text-muted)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
              Security Console
            </span>
          </div>

          {/* Identity panel */}
          <IdentityPanel
            x25519PubKey={auth.x25519PubKey}
            kyberPubKey={auth.kyberPubKey}
            keyStatus={auth.keyStatus}
            userId={auth.user.id}
          />

          {/* Security dashboard */}
          <SecurityDashboard
            streamStatus={messaging.streamStatus}
            latencyMs={messaging.latencyMs}
            epoch={crypto.currentEpoch}
            sessionCount={messaging.contacts.filter(c => c.sessionEstablished).length}
          />

          {/* Logout */}
          <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
            <button
              className="btn btn-ghost"
              style={{ width: '100%', fontSize: '0.75rem', color: 'var(--error)', borderColor: 'rgba(255,68,68,0.2)' }}
              onClick={auth.logout}
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>

      {/* PQXDH Handshake overlay */}
      <HandshakeOverlay
        isOpen={showHandshake}
        targetName={activeContact?.displayName ?? ''}
        status={crypto.handshakeStatus}
        onClose={() => { setShowHandshake(false); crypto.resetHandshakeStatus(); }}
      />
    </div>
  );
}
