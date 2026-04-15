import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

// Warn if credentials are missing (demo mode)
if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('[Supabase] No credentials found — running in demo mode. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local');
}

export const supabase = createClient(supabaseUrl || 'https://placeholder.supabase.co', supabaseAnonKey || 'placeholder');

// ─── Supabase helpers ──────────────────────────────────────────────────────

export async function uploadPublicBundle(userId: string, x25519PubKey: string, kyberPubKey: string) {
  if (!supabaseUrl) return { error: null }; // demo mode
  return supabase.from('user_bundles').upsert({
    user_id: userId,
    x25519_public_key: x25519PubKey,
    kyber_public_key: kyberPubKey,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' });
}

export async function fetchPublicBundle(userId: string) {
  if (!supabaseUrl) return null; // demo mode
  const { data, error } = await supabase
    .from('user_bundles')
    .select('*')
    .eq('user_id', userId)
    .single();
  if (error) { console.error('[Supabase] fetchPublicBundle error:', error); return null; }
  return data as { user_id: string; x25519_public_key: string; kyber_public_key: string };
}
