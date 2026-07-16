-- Allow admins to manage profile rows (including role changes) via client-side calls.
-- Keep existing self-update policy from 002_profiles_update_policy.sql.

drop policy if exists profiles_admin_update_any on profiles;
create policy profiles_admin_update_any on profiles
  for update
  to authenticated
  using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
    )
  );
