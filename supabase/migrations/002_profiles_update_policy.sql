-- Fix profiles write access for authenticated users.
-- This addresses: "permission denied for table profiles" during Roblox linking.

grant usage on schema public to authenticated;
grant select, insert, update on table public.profiles to authenticated;

-- Remove overly broad write policy from initial migration.
drop policy if exists profiles_manage_admin on profiles;

-- Keep public read policy from 001_init.sql: profiles_select_public.

-- Required for client-side profile bootstrap upsert in src/lib/auth.ts.
drop policy if exists profiles_insert_own on profiles;
create policy profiles_insert_own on profiles
  for insert
  to authenticated
  with check (auth.uid() = id);

-- Requested policy: allow users to update only their own profile row.
drop policy if exists "Users can update their own profile" on profiles;
create policy "Users can update their own profile"
on profiles for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);
