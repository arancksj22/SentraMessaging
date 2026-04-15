import { createClient } from '@supabase/supabase-js';
import type { Contact } from './types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

// Warn if credentials are missing (demo mode)
if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('[Supabase] No credentials found — running in demo mode. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local');
}

export const supabase = createClient(supabaseUrl || 'https://placeholder.supabase.co', supabaseAnonKey || 'placeholder');

function isMissingColumnError(error: unknown): boolean {
  const code = (error as { code?: string } | null)?.code;
  return code === '42703' || code === 'PGRST204';
}

// ─── Supabase helpers ──────────────────────────────────────────────────────

export async function uploadPublicBundle(
  userId: string,
  x25519PubKey: string,
  kyberPubKey: string,
  publicEmail?: string | null,
  displayName?: string | null,
) {
  if (!supabaseUrl) return { error: null }; // demo mode
  const preferred = await supabase.from('user_bundles').upsert({
    user_id: userId,
    x25519_public_key: x25519PubKey,
    kyber_public_key: kyberPubKey,
    public_email: publicEmail ?? null,
    display_name: displayName ?? null,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' });

  if (!preferred.error) return preferred;
  if (!isMissingColumnError(preferred.error)) return preferred;

  // Backward compatibility: project hasn't applied metadata migration yet.
  const fallback = await supabase.from('user_bundles').upsert({
    user_id: userId,
    x25519_public_key: x25519PubKey,
    kyber_public_key: kyberPubKey,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' });

  if (!fallback.error) {
    console.warn('[Supabase] user_bundles metadata columns missing; using basic bundle upload. Apply migration 002_contact_metadata.sql to enable contact email/name.');
  }
  return fallback;
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

function shortUserId(userId: string): string {
  return `${userId.slice(0, 8)}...${userId.slice(-4)}`;
}

function fallbackDisplayName(userId: string, publicEmail?: string | null, displayName?: string | null): string {
  if (displayName && displayName.trim()) return displayName.trim();
  if (publicEmail && publicEmail.includes('@')) return publicEmail.split('@')[0];
  return shortUserId(userId);
}

export async function fetchContacts(currentUserId: string): Promise<Contact[]> {
  if (!supabaseUrl) {
    return [
      { userId: 'demo-bob-001', displayName: 'Bob Chen', email: 'bob@ciphercore.demo', sessionEstablished: false },
      { userId: 'demo-charlie-002', displayName: 'Charlie Park', email: 'charlie@ciphercore.demo', sessionEstablished: false },
      { userId: 'demo-eve-003', displayName: 'Eve Santos', email: 'eve@ciphercore.demo', sessionEstablished: true },
    ];
  }

  const preferred = await supabase
    .from('user_bundles')
    .select('user_id, public_email, display_name')
    .neq('user_id', currentUserId)
    .limit(200);

  let data = preferred.data as Array<{ user_id: string; public_email?: string | null; display_name?: string | null }> | null;
  let error = preferred.error;

  if (error && isMissingColumnError(error)) {
    const fallback = await supabase
      .from('user_bundles')
      .select('user_id')
      .neq('user_id', currentUserId)
      .limit(200);
    data = fallback.data as Array<{ user_id: string }> | null;
    error = fallback.error;
    if (!error) {
      console.warn('[Supabase] user_bundles metadata columns missing; contacts will show fallback names. Apply migration 002_contact_metadata.sql.');
    }
  }

  if (error) {
    // First-run setup often hits this before the SQL migration is applied.
    if ((error as { code?: string }).code === 'PGRST205') {
      console.warn('[Supabase] user_bundles table not found yet. Apply frontend/supabase/migrations/001_user_bundles.sql');
      return [];
    }
    if ((error as { code?: string }).code === '42501') {
      console.warn('[Supabase] Missing table grants for authenticated role on user_bundles. Apply migration grants.');
      return [];
    }
    console.error('[Supabase] fetchContacts error:', error);
    return [];
  }

  return (data ?? []).map((row) => ({
    userId: row.user_id as string,
    displayName: fallbackDisplayName(row.user_id as string, row.public_email as string | null, row.display_name as string | null),
    email: (row.public_email as string | null) ?? `${shortUserId(row.user_id as string)}@sentramesh.local`,
    sessionEstablished: false,
  }));
}
