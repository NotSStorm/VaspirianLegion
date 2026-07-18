create table if not exists personnel_exclusions (
  id uuid primary key default gen_random_uuid(),
  normalized_name text not null unique,
  display_name text not null,
  reason text,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table personnel_exclusions enable row level security;

grant usage on schema public to authenticated;
grant select on table public.personnel_exclusions to authenticated;
grant insert, update, delete on table public.personnel_exclusions to authenticated;

drop policy if exists personnel_exclusions_select_authenticated on personnel_exclusions;
create policy personnel_exclusions_select_authenticated on personnel_exclusions
  for select
  to authenticated
  using (true);

drop policy if exists personnel_exclusions_staff_manage on personnel_exclusions;
create policy personnel_exclusions_staff_manage on personnel_exclusions
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

delete from roster
where exists (
  select 1
  from profiles
  where profiles.id = roster.profile_id
    and lower(regexp_replace(coalesce(profiles.roblox_username, ''), '[_\s]+', '', 'g')) = 'jerrytheproboss'
);

delete from personnel
where lower(regexp_replace(coalesce(roblox_username, ''), '[_\s]+', '', 'g')) = 'jerrytheproboss';

insert into personnel_exclusions (normalized_name, display_name, reason)
values ('jerrytheproboss', 'jerrytheproboss', 'Removed from Personnel')
on conflict (normalized_name) do update
set display_name = excluded.display_name,
    reason = excluded.reason,
    updated_at = now();