-- Fix authenticated profile writes used by Roblox verification and profile bootstrap.
-- Apply this on existing environments where profiles writes fail with:
-- "permission denied for table profiles"

-- Ensure table privileges are present for Supabase authenticated users.
grant usage on schema public to authenticated;
grant select, insert, update on table public.profiles to authenticated;

-- Replace the overly broad legacy policy with explicit self-service policies.
drop policy if exists profiles_manage_admin on profiles;

-- Keep public read behavior from 001_init.sql (profiles_select_public).

create policy profiles_insert_own on profiles
  for insert
  to authenticated
  with check (id = auth.uid());

create policy profiles_update_own on profiles
  for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());
