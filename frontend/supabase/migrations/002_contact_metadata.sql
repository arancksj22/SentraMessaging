-- Add lightweight public metadata for contact discovery UI
-- Safe to run multiple times

alter table if exists public.user_bundles
  add column if not exists public_email text,
  add column if not exists display_name text;
