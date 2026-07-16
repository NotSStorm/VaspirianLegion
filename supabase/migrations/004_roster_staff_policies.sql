-- Allow officers/admins to manage roster entries when processing applications.

grant usage on schema public to authenticated;
grant select, insert, update on table public.roster to authenticated;

drop policy if exists roster_staff_manage on roster;
create policy roster_staff_manage on roster
  for all
  to authenticated
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
        and profiles.role in ('officer', 'admin')
    )
  )
  with check (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
        and profiles.role in ('officer', 'admin')
    )
  );
