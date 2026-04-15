'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { createTransport } from '../lib/messaging-bridge';
import { saveMessage, getConversationMessages, getSessionByRecipient, getSession, clearConversationMessages, deleteSession } from '../lib/db';
import { supabase, fetchContacts } from '../lib/supabase';
import type { LocalMessage, MessageEnvelope, StreamStatus, Contact } from '../lib/types';
import type { User } from '@supabase/supabase-js';
import type { useCrypto } from './useCrypto';

type CryptoHook = ReturnType<typeof useCrypto>;

export function useMessaging(user: User | null, crypto: CryptoHook) {
  const [messages, setMessages]         = useState<LocalMessage[]>([]);
  const [streamStatus, setStreamStatus] = useState<StreamStatus>('disconnected');
  const [latencyMs, setLatencyMs]       = useState<number | null>(null);
  const [contacts, setContacts]         = useState<Contact[]>([]);

  // Ref so inbound message handler always has the current conversation id (avoids stale closure)
  const activeConvIdRef = useRef<string | null>(null);
  const transportRef    = useRef(createTransport());
  const localConnectIntentRef = useRef<Set<string>>(new Set());
  const peerConnectIntentRef  = useRef<Set<string>>(new Set());

  const markConnected = useCallback((peerId: string, connected: boolean) => {
    setContacts(prev => prev.map(c => c.userId === peerId ? { ...c, sessionEstablished: connected } : c));
  }, []);

  const sendControlEnvelope = useCallback(async (
    recipientId: string,
    type: 'connect-intent' | 'connect-ack',
    handshake?: MessageEnvelope['handshake'],
  ) => {
    if (!user) return;
    const conversationId = [user.id, recipientId].sort().join(':');
    const controlEnvelope: MessageEnvelope = {
      id: `ctrl-${type}-${Date.now()}`,
      conversationId,
      senderId: user.id,
      recipientId,
      ciphertextB64: '',
      dhHeaderB64: '',
      msgNum: 0,
      prevChainLen: 0,
      timestamp: new Date().toISOString(),
      handshake,
      control: { type },
    };
    await transportRef.current.send(controlEnvelope);
  }, [user]);

  useEffect(() => {
    let cancelled = false;
    if (!user) {
      setContacts([]);
      return;
    }

    (async () => {
      const found = await fetchContacts(user.id);
      const withSessionState = await Promise.all(
        found.map(async (contact) => {
          const session = await getSessionByRecipient(contact.userId);
          return {
            ...contact,
            sessionEstablished: Boolean(session?.established && session.handshakeMode === 'pqxdh-v1'),
          };
        }),
      );
      if (!cancelled) {
        setContacts(withSessionState);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  useEffect(() => {
    if (!user) return;
    const t = transportRef.current;
    let disposed = false;

    const connectWithToken = async () => {
      // Provide auth token to transport before the connection handshake.
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (token) t.setToken?.(token);
      if (disposed) return;

      t.connect(
        user.id,
        async (envelope: MessageEnvelope) => {
        if (envelope.control?.type === 'connect-intent') {
          peerConnectIntentRef.current.add(envelope.senderId);
          // If both users explicitly requested connect, deterministically pick
          // one side to send the handshake payload.
          if (localConnectIntentRef.current.has(envelope.senderId) && user.id.localeCompare(envelope.senderId) < 0) {
            const pqxdh = await crypto.initiatePQXDHHandshake(envelope.senderId, true);
            if (pqxdh.session?.established) {
              await sendControlEnvelope(envelope.senderId, 'connect-ack', pqxdh.handshakePayload ?? undefined);
              markConnected(envelope.senderId, true);
            }
          }
          return;
        }

        if (envelope.control?.type === 'connect-ack') {
          const pqxdhPayload = envelope.handshake;
          if (pqxdhPayload?.version === 'pqxdh-v1') {
            const established = await crypto.completeInboundPQXDHHandshake(envelope.senderId, pqxdhPayload, true);
            if (established?.established) {
              markConnected(envelope.senderId, true);
            }
          }
          return;
        }

        const existingSession = await getSessionByRecipient(envelope.senderId);
        let sessionEstablished = Boolean(existingSession?.established && existingSession.handshakeMode === 'pqxdh-v1');
        const pqxdhPayload = envelope.handshake;
        if (pqxdhPayload?.version === 'pqxdh-v1') {
          // Inbound handshake payload is authoritative for this envelope.
          // Force refresh avoids stale local sessions causing decrypt mismatch.
          const established = await crypto.completeInboundPQXDHHandshake(envelope.senderId, pqxdhPayload, true);
          sessionEstablished = Boolean(established?.established);
          if (sessionEstablished) {
            markConnected(envelope.senderId, true);
          }
        } else if (!existingSession?.established) {
          const established = await crypto.initiateHandshake(envelope.senderId);

          sessionEstablished = Boolean(established?.established);
          if (sessionEstablished) {
            markConnected(envelope.senderId, true);
          }
        }

        setContacts(prev => {
          if (prev.some(c => c.userId === envelope.senderId)) {
            return prev;
          }
          return [
            {
              userId: envelope.senderId,
              displayName: `user-${envelope.senderId.slice(0, 6)}`,
              email: 'auto-discovered@sentramesh.local',
              sessionEstablished,
            },
            ...prev,
          ];
        });

        const result = await crypto.decryptInbound({
          ciphertextB64:  envelope.ciphertextB64,
          dhHeaderB64:    envelope.dhHeaderB64,
          msgNum:         envelope.msgNum,
          prevChainLen:   envelope.prevChainLen,
          conversationId: envelope.conversationId,
          handshake:      envelope.handshake,
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
    };

    connectWithToken();

    return () => {
      disposed = true;
      t.disconnect();
    };
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
    let outboundHandshake: MessageEnvelope['handshake'];

    const isConnected = Boolean(contacts.find(c => c.userId === recipientId)?.sessionEstablished);
    if (!isConnected) {
      console.warn('[useMessaging] Message blocked: connect first');
      return;
    }

    const existing = await getSession(conversationId);
    if (!existing?.established) {
      console.warn('[useMessaging] Message blocked: missing local session');
      return;
    }

    // Always include a handshake payload for the first outbound message of a session.
    // This prevents a local-only "Connect" action from creating state the peer cannot derive.
    if (existing.handshakeMode === 'pqxdh-v1' && existing.ratchetState.sendMsgNum === 0) {
      const refreshed = await crypto.initiatePQXDHHandshake(recipientId, true);
      if (!refreshed.session?.established) {
        console.error('[useMessaging] Handshake refresh failed; message not sent');
        return;
      }
      outboundHandshake = refreshed.handshakePayload ?? undefined;
      setContacts(prev => prev.map(c => c.userId === recipientId ? { ...c, sessionEstablished: true } : c));
    }

    let encrypted = await crypto.encryptOutbound(plaintext, conversationId);
    if (!encrypted) {
      // Repair stale local session state and retry once.
      const repaired = await crypto.initiatePQXDHHandshake(recipientId, true);
      if (repaired.session?.established) {
        setContacts(prev => prev.map(c => c.userId === recipientId ? { ...c, sessionEstablished: true } : c));
        outboundHandshake = repaired.handshakePayload ?? outboundHandshake;
        encrypted = await crypto.encryptOutbound(plaintext, conversationId);
      }
    }
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
      handshake:     outboundHandshake,
    };

    try {
      await transportRef.current.send(envelope);
      setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, delivered: true } : m));
    } catch (err) {
      console.error('[useMessaging] Send failed:', err);
    }
  }, [user, contacts, crypto]);

  const requestConnection = useCallback(async (recipientId: string) => {
    if (!user) return;
    localConnectIntentRef.current.add(recipientId);
    await sendControlEnvelope(recipientId, 'connect-intent');

    // If peer intent already arrived, non-initiator waits for initiator ack.
    // Initiator sends the ack payload.
    if (peerConnectIntentRef.current.has(recipientId) && user.id.localeCompare(recipientId) < 0) {
      const pqxdh = await crypto.initiatePQXDHHandshake(recipientId, true);
      if (!pqxdh.session?.established) return;
      await sendControlEnvelope(recipientId, 'connect-ack', pqxdh.handshakePayload ?? undefined);
      markConnected(recipientId, true);
    }
  }, [user, crypto, sendControlEnvelope, markConnected]);

  const resetConversation = useCallback(async (recipientId: string) => {
    if (!user) return;
    const conversationId = [user.id, recipientId].sort().join(':');
    await deleteSession(conversationId);
    await clearConversationMessages(conversationId);
    localConnectIntentRef.current.delete(recipientId);
    peerConnectIntentRef.current.delete(recipientId);
    setContacts(prev => prev.map(c => c.userId === recipientId ? { ...c, sessionEstablished: false, lastMessage: undefined } : c));
    if (activeConvIdRef.current === conversationId) {
      setMessages([]);
    }
  }, [user]);

  return { messages, streamStatus, latencyMs, contacts, setContacts, sendMessage, loadConversation, resetConversation, requestConnection };
}
