'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { createTransport } from '../lib/messaging-bridge';
import { saveMessage, getConversationMessages } from '../lib/db';
import type { LocalMessage, MessageEnvelope, StreamStatus, Contact } from '../lib/types';
import type { User } from '@supabase/supabase-js';
import type { useCrypto } from './useCrypto';

type CryptoHook = ReturnType<typeof useCrypto>;

export function useMessaging(user: User | null, crypto: CryptoHook) {
  const [messages, setMessages]         = useState<LocalMessage[]>([]);
  const [streamStatus, setStreamStatus] = useState<StreamStatus>('disconnected');
  const [latencyMs, setLatencyMs]       = useState<number | null>(null);
  const [contacts, setContacts]         = useState<Contact[]>([
    { userId: 'demo-bob-001',     displayName: 'Bob Chen',    email: 'bob@ciphercore.demo',     sessionEstablished: false },
    { userId: 'demo-charlie-002', displayName: 'Charlie Park', email: 'charlie@ciphercore.demo', sessionEstablished: false },
    { userId: 'demo-eve-003',     displayName: 'Eve Santos',   email: 'eve@ciphercore.demo',     sessionEstablished: true  },
  ]);

  // Ref so inbound message handler always has the current conversation id (avoids stale closure)
  const activeConvIdRef = useRef<string | null>(null);
  const transportRef    = useRef(createTransport());

  useEffect(() => {
    if (!user) return;
    const t = transportRef.current;

    t.connect(
      user.id,
      async (envelope: MessageEnvelope) => {
        const result = await crypto.decryptInbound({
          ciphertextB64:  envelope.ciphertextB64,
          dhHeaderB64:    envelope.dhHeaderB64,
          msgNum:         envelope.msgNum,
          prevChainLen:   envelope.prevChainLen,
          conversationId: envelope.conversationId,
        });

        const raw     = atob(envelope.ciphertextB64);
        const preview = Array.from(raw.slice(0, 8), c => c.charCodeAt(0).toString(16).padStart(2, '0')).join('');

        const msg: LocalMessage = {
          id:                envelope.id,
          conversationId:    envelope.conversationId,
          direction:         'inbound',
          plaintext:         result?.plaintext ?? '[decryption failed]',
          ciphertextPreview: preview,
          timestamp:         envelope.timestamp,
          epoch:             result?.newEpoch ?? 0,
          delivered:         true,
        };

        await saveMessage(msg);
        // Use ref — not state — so this always reflects the current conversation
        if (envelope.conversationId === activeConvIdRef.current) {
          setMessages(prev => [...prev, msg]);
        }
      },
      (status, latency) => {
        setStreamStatus(status as StreamStatus);
        if (latency !== undefined) setLatencyMs(latency);
      },
    );

    return () => t.disconnect();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const loadConversation = useCallback(async (conversationId: string) => {
    activeConvIdRef.current = conversationId;
    const msgs = await getConversationMessages(conversationId);
    setMessages(msgs);
  }, []);

  const sendMessage = useCallback(async (plaintext: string, recipientId: string) => {
    if (!user) return;
    const conversationId = [user.id, recipientId].sort().join(':');

    if (!contacts.find(c => c.userId === recipientId)?.sessionEstablished) {
      await crypto.initiateHandshake(recipientId);
      setContacts(prev => prev.map(c => c.userId === recipientId ? { ...c, sessionEstablished: true } : c));
    }

    const encrypted = await crypto.encryptOutbound(plaintext, conversationId);
    if (!encrypted) { console.error('[useMessaging] Encryption failed'); return; }

    const raw     = atob(encrypted.ciphertextB64);
    const preview = Array.from(raw.slice(0, 8), c => c.charCodeAt(0).toString(16).padStart(2, '0')).join('');

    const msg: LocalMessage = {
      id:                `${crypto.currentEpoch}-${Date.now()}`,
      conversationId,
      direction:         'outbound',
      plaintext,
      ciphertextPreview: preview,
      timestamp:         new Date().toISOString(),
      epoch:             encrypted.newEpoch,
      delivered:         false,
    };

    await saveMessage(msg);
    setMessages(prev => [...prev, msg]);

    const envelope: MessageEnvelope = {
      id:            msg.id,
      conversationId,
      senderId:      user.id,
      recipientId,
      ciphertextB64: encrypted.ciphertextB64,
      dhHeaderB64:   encrypted.dhHeaderB64,
      msgNum:        encrypted.msgNum,
      prevChainLen:  encrypted.prevChainLen,
      timestamp:     msg.timestamp,
    };

    try {
      await transportRef.current.send(envelope);
      setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, delivered: true } : m));
    } catch (err) {
      console.error('[useMessaging] Send failed:', err);
    }
  }, [user, contacts, crypto]);

  return { messages, streamStatus, latencyMs, contacts, setContacts, sendMessage, loadConversation };
}
