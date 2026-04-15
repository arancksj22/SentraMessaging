'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import * as Comlink from 'comlink';
import { getIdentityKeys, saveSession, getSession } from '../lib/db';
import { fetchPublicBundle } from '../lib/supabase';
import type { CryptoWorkerAPI, HandshakeStatus, SessionState, PQXDHHandshakePayload } from '../lib/types';
import type { User } from '@supabase/supabase-js';

interface CryptoState {
  workerReady: boolean;
  handshakeStatus: HandshakeStatus;
  handshakeTarget: string | null;
  currentEpoch: number;
}

export function useCrypto(user: User | null) {
  const [state, setState] = useState<CryptoState>({
    workerReady: false,
    handshakeStatus: 'idle',
    handshakeTarget: null,
    currentEpoch: 0,
  });
  const workerRef = useRef<Worker | null>(null);
  const apiRef    = useRef<Comlink.Remote<CryptoWorkerAPI> | null>(null);

  const isCompatibleSession = useCallback((session: SessionState | null | undefined, mode: 'pqxdh-v1' | 'static-fallback-v1') => {
    return Boolean(
      session?.established &&
      session.ratchetState.receivingChainKey &&
      session.handshakeMode === mode,
    );
  }, []);

  // Initialize persistent worker
  useEffect(() => {
    if (!user) return;
    const worker = new Worker(new URL('../lib/crypto.worker.ts', import.meta.url), { type: 'module' });
    workerRef.current = worker;
    apiRef.current = Comlink.wrap<CryptoWorkerAPI>(worker);
    setState(prev => ({ ...prev, workerReady: true }));
    return () => { worker.terminate(); workerRef.current = null; apiRef.current = null; };
  }, [user]);

  const initiatePQXDHHandshake = useCallback(async (
    recipientId: string,
    force = false,
  ): Promise<{ session: SessionState | null; handshakePayload: PQXDHHandshakePayload | null }> => {
    if (!user || !apiRef.current) return { session: null, handshakePayload: null };
    const api = apiRef.current;

    const convId = [user.id, recipientId].sort().join(':');
    const existing = await getSession(convId);
    if (!force && existing && isCompatibleSession(existing, 'pqxdh-v1')) {
      setState(prev => ({ ...prev, handshakeStatus: 'established', currentEpoch: existing.ratchetState.epoch }));
      return { session: existing, handshakePayload: null };
    }

    setState(prev => ({ ...prev, handshakeStatus: 'fetching_bundle', handshakeTarget: recipientId }));
    try {
      let bundle = await fetchPublicBundle(recipientId);
      if (!bundle && !process.env.NEXT_PUBLIC_SUPABASE_URL) {
        bundle = {
          user_id: recipientId,
          x25519_public_key: btoa('demo-recipient-x25519-pub-key!!!!!'),
          kyber_public_key: btoa('demo-recipient-kyber-pub-key-placeholder'),
        };
      }
      if (!bundle) {
        throw new Error('Recipient public bundle not found. Ask them to sign in once to upload keys.');
      }

      const myKeys = await getIdentityKeys(user.id);
      if (!myKeys) throw new Error('Local keys not found');
      const enc = (u: Uint8Array) => btoa(String.fromCharCode(...u));

      setState(prev => ({ ...prev, handshakeStatus: 'x25519_dh' }));
      await new Promise(r => setTimeout(r, 250));

      setState(prev => ({ ...prev, handshakeStatus: 'kyber_encapsulate' }));
      const pqxdh = await api.performPQXDH({
        myX25519PrivKey: enc(myKeys.x25519PrivKey),
        theirX25519PubKey: bundle.x25519_public_key,
        theirKyberPubKey: bundle.kyber_public_key,
      });
      await new Promise(r => setTimeout(r, 250));

      setState(prev => ({ ...prev, handshakeStatus: 'hkdf_derive' }));

      const isInitiator = user.id.localeCompare(recipientId) < 0;
      const ratchetState = await api.initRatchet({
        sharedSecret: pqxdh.sharedSecret,
        isInitiator,
        theirDHPub: pqxdh.ephemeralX25519PubKey,
      });

      const session: SessionState = {
        conversationId: convId,
        recipientId,
        ratchetState,
        established: true,
        establishedAt: new Date().toISOString(),
        handshakeMode: 'pqxdh-v1',
      };

      await saveSession(session);
      setState(prev => ({ ...prev, handshakeStatus: 'established', currentEpoch: ratchetState.epoch }));

      return {
        session,
        handshakePayload: {
          version: 'pqxdh-v1',
          ephemeralX25519PubKey: pqxdh.ephemeralX25519PubKey,
          kyberCiphertext: pqxdh.kyberCiphertext,
        },
      };
    } catch (err) {
      console.error('[useCrypto] PQXDH handshake failed:', err);
      setState(prev => ({ ...prev, handshakeStatus: 'error' }));
      return { session: null, handshakePayload: null };
    }
  }, [user, isCompatibleSession]);

  const completeInboundPQXDHHandshake = useCallback(async (
    senderId: string,
    payload: PQXDHHandshakePayload,
    force = false,
  ): Promise<SessionState | null> => {
    if (!user || !apiRef.current) return null;
    const api = apiRef.current;

    const convId = [user.id, senderId].sort().join(':');
    const existing = await getSession(convId);
    if (!force && existing && isCompatibleSession(existing, 'pqxdh-v1')) {
      setState(prev => ({ ...prev, handshakeStatus: 'established', currentEpoch: existing.ratchetState.epoch }));
      return existing;
    }

    setState(prev => ({ ...prev, handshakeStatus: 'fetching_bundle', handshakeTarget: senderId }));
    try {
      const myKeys = await getIdentityKeys(user.id);
      if (!myKeys) throw new Error('Local keys not found');
      const enc = (u: Uint8Array) => btoa(String.fromCharCode(...u));

      setState(prev => ({ ...prev, handshakeStatus: 'x25519_dh' }));
      await new Promise(r => setTimeout(r, 150));

      setState(prev => ({ ...prev, handshakeStatus: 'kyber_encapsulate' }));
      const inbound = await api.completeInboundPQXDH({
        myX25519PrivKey: enc(myKeys.x25519PrivKey),
        theirX25519PubKey: payload.ephemeralX25519PubKey,
        myKyberPrivKey: enc(myKeys.kyberPrivKey),
        kyberCiphertext: payload.kyberCiphertext,
      });

      setState(prev => ({ ...prev, handshakeStatus: 'hkdf_derive' }));
      const isInitiator = user.id.localeCompare(senderId) < 0;
      const ratchetState = await api.initRatchet({
        sharedSecret: inbound.sharedSecret,
        isInitiator,
        theirDHPub: payload.ephemeralX25519PubKey,
      });

      const session: SessionState = {
        conversationId: convId,
        recipientId: senderId,
        ratchetState,
        established: true,
        establishedAt: new Date().toISOString(),
        handshakeMode: 'pqxdh-v1',
      };

      await saveSession(session);
      setState(prev => ({ ...prev, handshakeStatus: 'established', currentEpoch: ratchetState.epoch }));
      return session;
    } catch (err) {
      console.error('[useCrypto] Inbound PQXDH completion failed:', err);
      setState(prev => ({ ...prev, handshakeStatus: 'error' }));
      return null;
    }
  }, [user, isCompatibleSession]);

  const initiateHandshake = useCallback(async (recipientId: string, force = false): Promise<SessionState | null> => {
    if (!user || !apiRef.current) return null;
    const api = apiRef.current;

    // Check if session already exists
    const convId = [user.id, recipientId].sort().join(':');
    const existing = await getSession(convId);
    if (!force && existing && isCompatibleSession(existing, 'static-fallback-v1')) {
      setState(prev => ({ ...prev, handshakeStatus: 'established', currentEpoch: existing.ratchetState.epoch }));
      return existing;
    }

    setState(prev => ({ ...prev, handshakeStatus: 'fetching_bundle', handshakeTarget: recipientId }));
    try {
      // 1. Fetch recipient bundle from Supabase (or demo mock)
      let bundle = await fetchPublicBundle(recipientId);
      if (!bundle && !process.env.NEXT_PUBLIC_SUPABASE_URL) {
        // Demo fallback: generate fake bundle
        bundle = {
          user_id: recipientId,
          x25519_public_key: btoa('demo-recipient-x25519-pub-key!!!!!'),
          kyber_public_key:  btoa('demo-recipient-kyber-pub-key-placeholder'),
        };
      }
      if (!bundle) {
        throw new Error('Recipient public bundle not found. Ask them to sign in once to upload keys.');
      }

      const myKeys = await getIdentityKeys(user.id);
      if (!myKeys) throw new Error('Local keys not found');
      const enc = (u: Uint8Array) => btoa(String.fromCharCode(...u));

      // 2. X25519 DH
      setState(prev => ({ ...prev, handshakeStatus: 'x25519_dh' }));
      await new Promise(r => setTimeout(r, 400)); // visual pacing

      // 3. Kyber-768 encapsulate
      setState(prev => ({ ...prev, handshakeStatus: 'kyber_encapsulate' }));
      await new Promise(r => setTimeout(r, 600));

      // 4. HKDF combine → shared secret
      setState(prev => ({ ...prev, handshakeStatus: 'hkdf_derive' }));
      const { sharedSecret } = await api.deriveStaticSharedSecret({
        myX25519PrivKey:   enc(myKeys.x25519PrivKey),
        theirX25519PubKey: bundle.x25519_public_key,
      });
      await new Promise(r => setTimeout(r, 300));

      // 5. Initialize Double Ratchet
      const isInitiator = user.id.localeCompare(recipientId) < 0;
      const ratchetState = await api.initRatchet({
        sharedSecret,
        isInitiator,
        theirDHPub: bundle.x25519_public_key,
      });

      const session: SessionState = {
        conversationId: convId,
        recipientId,
        ratchetState,
        established: true,
        establishedAt: new Date().toISOString(),
        handshakeMode: 'static-fallback-v1',
      };

      await saveSession(session);
      setState(prev => ({ ...prev, handshakeStatus: 'established', currentEpoch: ratchetState.epoch }));
      return session;
    } catch (err) {
      console.error('[useCrypto] Handshake failed:', err);
      setState(prev => ({ ...prev, handshakeStatus: 'error' }));
      return null;
    }
  }, [user, isCompatibleSession]);

  const encryptOutbound = useCallback(async (plaintext: string, conversationId: string) => {
    if (!user || !apiRef.current) return null;
    const session = await getSession(conversationId);
    if (!session) return null;

    try {
      const result = await apiRef.current.encryptMessage({ plaintext, ratchetState: session.ratchetState });
      const updatedSession: SessionState = { ...session, ratchetState: result.newRatchetState };
      await saveSession(updatedSession);
      setState(prev => ({ ...prev, currentEpoch: result.newRatchetState.epoch }));
      return { ...result, newEpoch: result.newRatchetState.epoch };
    } catch (err) {
      console.error('[useCrypto] Encrypt failed:', err);
      return null;
    }
  }, [user]);

  const decryptInbound = useCallback(async (params: {
    ciphertextB64: string;
    dhHeaderB64: string;
    msgNum: number;
    prevChainLen: number;
    conversationId: string;
    handshake?: PQXDHHandshakePayload;
  }) => {
    if (!user || !apiRef.current) return null;
    const session = await getSession(params.conversationId);
    if (!session) return null;

    try {
      const result = await apiRef.current.decryptMessage({ ...params, ratchetState: session.ratchetState });
      await saveSession({ ...session, ratchetState: result.newRatchetState });
      setState(prev => ({ ...prev, currentEpoch: result.newRatchetState.epoch }));
      return { plaintext: result.plaintext, newEpoch: result.newRatchetState.epoch };
    } catch (err) {
      const message = String(err);
      const isRecoverable = message.includes('Missing receiving chain key') || message.includes('OperationError');
      if (isRecoverable) {
        const peerId = params.conversationId.split(':').find(id => id !== user.id);
        if (peerId) {
          let repaired: SessionState | null = null;

          // If the failing message carries a PQXDH payload, rebuild the
          // inbound session from that exact payload so both peers derive
          // the same key material before decrypt retry.
          if (params.handshake?.version === 'pqxdh-v1') {
            repaired = await completeInboundPQXDHHandshake(peerId, params.handshake, true);
          }

          // Fallback: explicitly refresh PQXDH session if no payload is attached.
          if (!repaired) {
            const refreshed = await initiatePQXDHHandshake(peerId, true);
            repaired = refreshed.session;
          }

          if (repaired) {
            try {
              const retry = await apiRef.current.decryptMessage({ ...params, ratchetState: repaired.ratchetState });
              await saveSession({ ...repaired, ratchetState: retry.newRatchetState });
              setState(prev => ({ ...prev, currentEpoch: retry.newRatchetState.epoch }));
              return { plaintext: retry.plaintext, newEpoch: retry.newRatchetState.epoch };
            } catch (retryErr) {
              console.error('[useCrypto] Decrypt retry failed:', retryErr);
            }
          }
        }
      }
      console.error('[useCrypto] Decrypt failed:', err);
      return null;
    }
  }, [user, completeInboundPQXDHHandshake, initiatePQXDHHandshake]);

  const resetHandshakeStatus = useCallback(() => {
    setState(prev => ({ ...prev, handshakeStatus: 'idle', handshakeTarget: null }));
  }, []);

  return {
    ...state,
    initiateHandshake,
    initiatePQXDHHandshake,
    completeInboundPQXDHHandshake,
    encryptOutbound,
    decryptInbound,
    resetHandshakeStatus,
  };
}
