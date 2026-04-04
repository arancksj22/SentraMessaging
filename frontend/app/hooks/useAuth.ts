'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, uploadPublicBundle } from '../lib/supabase';
import { getIdentityKeys, saveIdentityKeys } from '../lib/db';
import type { KeyStatus, CryptoWorkerAPI } from '../lib/types';
import type { User } from '@supabase/supabase-js';
import * as Comlink from 'comlink';

export interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
  keyStatus: KeyStatus;
  x25519PubKey: string | null;
  kyberPubKey: string | null;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    loading: true,
    error: null,
    keyStatus: 'unknown',
    x25519PubKey: null,
    kyberPubKey: null,
  });
  const workerRef = useRef<Worker | null>(null);

  const generateAndStoreKeys = useCallback(async (user: User) => {
    setState(prev => ({ ...prev, keyStatus: 'generating' }));
    try {
      // Spin up a transient worker for key generation
      const worker = new Worker(new URL('../lib/crypto.worker.ts', import.meta.url), { type: 'module' });
      workerRef.current = worker;
      const api = Comlink.wrap<CryptoWorkerAPI>(worker);

      const keys = await api.generateIdentityKeys();
      const dec = (s: string) => Uint8Array.from(atob(s), c => c.charCodeAt(0));

      await saveIdentityKeys(user.id, {
        x25519PrivKey: dec(keys.x25519PrivKey),
        x25519PubKey:  dec(keys.x25519PubKey),
        kyberPrivKey:  dec(keys.kyberPrivKey),
        kyberPubKey:   dec(keys.kyberPubKey),
      });

      worker.terminate();
      workerRef.current = null;

      // Upload public bundle to Supabase
      setState(prev => ({ ...prev, keyStatus: 'uploading' }));
      await uploadPublicBundle(user.id, keys.x25519PubKey, keys.kyberPubKey);

      setState(prev => ({
        ...prev,
        keyStatus: 'ready',
        x25519PubKey: keys.x25519PubKey,
        kyberPubKey: keys.kyberPubKey,
      }));
    } catch (err) {
      console.error('[useAuth] Key generation failed:', err);
      setState(prev => ({ ...prev, keyStatus: 'error', error: 'Key generation failed' }));
    }
  }, []);

  const loadExistingKeys = useCallback(async (user: User) => {
    const keys = await getIdentityKeys(user.id);
    if (!keys) {
      await generateAndStoreKeys(user);
      return;
    }
    const enc = (u: Uint8Array) => btoa(String.fromCharCode(...u));
    setState(prev => ({
      ...prev,
      keyStatus: 'ready',
      x25519PubKey: enc(keys.x25519PubKey),
      kyberPubKey:  enc(keys.kyberPubKey),
    }));
  }, [generateAndStoreKeys]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const user = session?.user ?? null;
      setState(prev => ({ ...prev, user, loading: false }));
      if (user) loadExistingKeys(user);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const user = session?.user ?? null;
      setState(prev => ({ ...prev, user, loading: false }));
      if (event === 'SIGNED_IN' && user)  loadExistingKeys(user);
      if (event === 'SIGNED_OUT') setState(prev => ({ ...prev, keyStatus: 'unknown', x25519PubKey: null, kyberPubKey: null }));
    });

    return () => {
      subscription.unsubscribe();
      workerRef.current?.terminate();
    };
  }, [loadExistingKeys]);

  const login = useCallback(async (email: string, password: string) => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setState(prev => ({ ...prev, loading: false, error: error.message }));
  }, []);

  const signup = useCallback(async (email: string, password: string) => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) setState(prev => ({ ...prev, loading: false, error: error.message }));
    else setState(prev => ({ ...prev, loading: false }));
  }, []);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  // Demo mode override: simulate logged-in state when no Supabase credentials
  useEffect(() => {
    const isDemo = !process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (isDemo && state.loading) {
      const demoUser = {
        id: 'demo-user-001',
        email: 'alice@ciphercore.demo',
        user_metadata: { full_name: 'Alice (Demo)' },
      } as unknown as User;
      setTimeout(() => {
        setState({ user: demoUser, loading: false, error: null, keyStatus: 'generating', x25519PubKey: null, kyberPubKey: null });
        // Simulate key gen in demo
        setTimeout(() => {
          setState(prev => ({
            ...prev,
            keyStatus: 'ready',
            x25519PubKey: btoa('demo-x25519-public-key-32bytes!!!!!'),
            kyberPubKey:  btoa('demo-kyber768-public-key-for-display-purposes-only'),
          }));
        }, 2500);
      }, 1000);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { ...state, login, signup, logout };
}
