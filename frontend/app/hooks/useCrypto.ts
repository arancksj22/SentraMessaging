'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import * as Comlink from 'comlink';
import { getIdentityKeys, saveSession, getSession } from '../lib/db';
import { fetchPublicBundle } from '../lib/supabase';
import type { CryptoWorkerAPI, HandshakeStatus, RatchetState, SessionState } from '../lib/types';
import type { User } from '@supabase/supabase-js';

export interface CryptoState {
  workerReady: boolean;
  handshakeStatus: HandshakeStatus;
  handshakeTarget: string | null;
  currentEpoch: number;
}

export interface CryptoAPI {
  initiateHandshake(recipientId: string): Promise<SessionState | null>;
  encryptOutbound(plaintext: string, conversationId: string): Promise<{
    ciphertextB64: string;
    dhHeaderB64: string;
    msgNum: number;
    prevChainLen: number;
    newEpoch: number;
  } | null>;
  decryptInbound(params: {
    ciphertextB64: string;
    dhHeaderB64: string;
    msgNum: number;
    prevChainLen: number;
    conversationId: string;
  }): Promise<{ plaintext: string; newEpoch: number } | null>;
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

  // Initialize persistent worker
  useEffect(() => {
    if (!user) return;
    const worker = new Worker(new URL('../lib/crypto.worker.ts', import.meta.url), { type: 'module' });
    workerRef.current = worker;
    apiRef.current = Comlink.wrap<CryptoWorkerAPI>(worker);
    setState(prev => ({ ...prev, workerReady: true }));
    return () => { worker.terminate(); workerRef.current = null; apiRef.current = null; };
  }, [user]);

  const initiateHandshake = useCallback(async (recipientId: string): Promise<SessionState | null> => {
    if (!user || !apiRef.current) return null;
    const api = apiRef.current;

    // Check if session already exists
    const convId = [user.id, recipientId].sort().join(':');
    const existing = await getSession(convId);
    if (existing?.established) {
      setState(prev => ({ ...prev, handshakeStatus: 'established', currentEpoch: existing.ratchetState.epoch }));
      return existing;
    }

    setState(prev => ({ ...prev, handshakeStatus: 'fetching_bundle', handshakeTarget: recipientId }));
    try {
      // 1. Fetch recipient bundle from Supabase (or demo mock)
      let bundle = await fetchPublicBundle(recipientId);
      if (!bundle) {
        // Demo fallback: generate fake bundle
        bundle = {
          user_id: recipientId,
          x25519_public_key: btoa('demo-recipient-x25519-pub-key!!!!!'),
          kyber_public_key:  btoa('demo-recipient-kyber-pub-key-placeholder'),
        };
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
      const { sharedSecret, ephemeralX25519PubKey } = await api.performPQXDH({
        myX25519PrivKey:   enc(myKeys.x25519PrivKey),
        theirX25519PubKey: bundle.x25519_public_key,
        theirKyberPubKey:  bundle.kyber_public_key,
      });
      await new Promise(r => setTimeout(r, 300));

      // 5. Initialize Double Ratchet
      const ratchetState = await api.initRatchet({
        sharedSecret,
        isInitiator: true,
        theirDHPub: bundle.x25519_public_key,
      });

      const session: SessionState = {
        conversationId: convId,
        recipientId,
        ratchetState,
        established: true,
        establishedAt: new Date().toISOString(),
      };

      await saveSession(session);
      setState(prev => ({ ...prev, handshakeStatus: 'established', currentEpoch: ratchetState.epoch }));
      void ephemeralX25519PubKey; // would be sent to recipient in production
      return session;
    } catch (err) {
      console.error('[useCrypto] Handshake failed:', err);
      setState(prev => ({ ...prev, handshakeStatus: 'error' }));
      return null;
    }
  }, [user]);

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
    ciphertextB64: string; dhHeaderB64: string; msgNum: number; prevChainLen: number; conversationId: string;
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
      console.error('[useCrypto] Decrypt failed:', err);
      return null;
    }
  }, [user]);

  const resetHandshakeStatus = useCallback(() => {
    setState(prev => ({ ...prev, handshakeStatus: 'idle', handshakeTarget: null }));
  }, []);

  return { ...state, initiateHandshake, encryptOutbound, decryptInbound, resetHandshakeStatus };
}
