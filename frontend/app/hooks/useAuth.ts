'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, uploadPublicBundle } from '../lib/supabase';
import { getIdentityKeys, saveIdentityKeys } from '../lib/db';
import type { KeyStatus, CryptoWorkerAPI } from '../lib/types';
import type { User } from '@supabase/supabase-js';
import * as Comlink from 'comlink';

const hasSupabaseConfig = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

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
  const authInFlightRef = useRef(false);
  const signupCooldownUntilRef = useRef(0);

  const isRateLimitError = (message: string | undefined) => {
    const m = (message ?? '').toLowerCase();
    return m.includes('rate') || m.includes('too many') || m.includes('over_email_send_rate_limit');
  };

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
      const { error } = await uploadPublicBundle(
        user.id,
        keys.x25519PubKey,
        keys.kyberPubKey,
        user.email ?? null,
        (user.user_metadata?.name as string | undefined) ?? null,
      );
      if (error) {
        console.error('[useAuth] Public bundle upload failed:', error);
        setState(prev => ({
          ...prev,
          keyStatus: 'error',
          error: 'Could not upload your public key bundle. Check Supabase table grants and RLS policy.',
        }));
        return;
      }

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
    const xPub = enc(keys.x25519PubKey);
    const kyPub = enc(keys.kyberPubKey);

    // Re-sync public bundle on login so contacts can discover this user even if
    // earlier uploads failed due temporary RLS/grant misconfiguration.
    const { error } = await uploadPublicBundle(
      user.id,
      xPub,
      kyPub,
      user.email ?? null,
      (user.user_metadata?.name as string | undefined) ?? null,
    );
    if (error) {
      console.error('[useAuth] Public bundle re-sync failed:', error);
      setState(prev => ({
        ...prev,
        keyStatus: 'error',
        error: 'Signed in, but failed to publish public key bundle. Messaging discovery may be unavailable.',
      }));
      return;
    }

    setState(prev => ({
      ...prev,
      keyStatus: 'ready',
      x25519PubKey: xPub,
      kyberPubKey:  kyPub,
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
    if (!hasSupabaseConfig) {
      setState(prev => ({ ...prev, loading: false, error: 'Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in frontend/.env.local and restart dev server.' }));
      return;
    }
    if (authInFlightRef.current) return;
    authInFlightRef.current = true;
    setState(prev => ({ ...prev, loading: true, error: null }));
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setState(prev => ({ ...prev, loading: false, error: error.message }));
        return;
      }
      setState(prev => ({ ...prev, loading: false }));
    } finally {
      authInFlightRef.current = false;
    }
  }, []);

  const signup = useCallback(async (email: string, password: string) => {
    if (!hasSupabaseConfig) {
      setState(prev => ({ ...prev, loading: false, error: 'Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in frontend/.env.local and restart dev server.' }));
      return;
    }
    if (authInFlightRef.current) return;

    const now = Date.now();
    if (now < signupCooldownUntilRef.current) {
      const seconds = Math.ceil((signupCooldownUntilRef.current - now) / 1000);
      setState(prev => ({
        ...prev,
        loading: false,
        error: `Signup temporarily paused to avoid email limits. Try again in ${seconds}s, or use Sign In if account already exists.`,
      }));
      return;
    }

    authInFlightRef.current = true;
    setState(prev => ({ ...prev, loading: true, error: null }));
    try {
      const { error } = await supabase.auth.signUp({ email: email.trim().toLowerCase(), password });
      if (error) {
        if (isRateLimitError(error.message)) {
          signupCooldownUntilRef.current = Date.now() + 60_000;
          setState(prev => ({
            ...prev,
            loading: false,
            error: 'Email rate limit reached. Please wait 60 seconds before creating another account, or use Sign In if this account already exists.',
          }));
          return;
        }
        setState(prev => ({ ...prev, loading: false, error: error.message }));
        return;
      }
      setState(prev => ({
        ...prev,
        loading: false,
        error: 'Check your inbox for a confirmation email, then return and sign in.',
      }));
    } finally {
      authInFlightRef.current = false;
    }
  }, []);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  // Demo mode: simulate auth + key gen when no Supabase credentials are configured
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_SUPABASE_URL) return;
    const demoUser = { id: 'demo-user-001', email: 'alice@ciphercore.demo' } as unknown as User;
    const t1 = setTimeout(() =>
      setState({ user: demoUser, loading: false, error: null, keyStatus: 'generating', x25519PubKey: null, kyberPubKey: null })
    , 1000);
    const t2 = setTimeout(() =>
      setState(prev => ({ ...prev, keyStatus: 'ready', x25519PubKey: btoa('demo-x25519-pub-key-32-bytes-placeholder'), kyberPubKey: btoa('demo-kyber768-pub-key-placeholder') }))
    , 3500);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  return { ...state, login, signup, logout };
}
