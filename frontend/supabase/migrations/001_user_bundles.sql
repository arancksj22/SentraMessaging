-- ─── SentraMessaging: Supabase Schema Migration ───────────────────────────
-- Run this in your Supabase SQL Editor

-- Enable RLS
alter default privileges in schema public revoke all on tables from anon, authenticated;

-- User public key bundles (read: any authenticated, write: own row only)
create table if not exists public.user_bundles (
  user_id           uuid primary key references auth.users(id) on delete cascade,
  x25519_public_key text not null,  -- base64-encoded X25519 public key (32 bytes)
  kyber_public_key  text not null,  -- base64-encoded Kyber-768 public key (1184 bytes)
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- Row-Level Security
alter table public.user_bundles enable row level security;

-- Any authenticated user can read all bundles (needed for PQXDH handshake)
create policy "Authenticated users can read bundles"
  on public.user_bundles for select
  to authenticated
  using (true);

-- Users can only insert/update their own row
create policy "Users manage own bundle"
  on public.user_bundles for all
  to authenticated
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Auto-update updated_at
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger user_bundles_updated_at
  before update on public.user_bundles
  for each row execute procedure update_updated_at();
