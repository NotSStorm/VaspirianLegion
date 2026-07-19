alter table if exists personnel_exclusions enable row level security;

grant usage on schema public to authenticated;
grant select on table public.personnel_exclusions to authenticated;

drop policy if exists personnel_exclusions_select_authenticated on personnel_exclusions;
drop policy if exists personnel_exclusions_select_staff on personnel_exclusions;
create policy personnel_exclusions_select_staff on personnel_exclusions
  for select
  to authenticated
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
        and profiles.role in ('officer', 'admin')
    )
  );
