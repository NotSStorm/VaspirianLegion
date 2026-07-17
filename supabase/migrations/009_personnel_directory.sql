-- Directory for battle-derived participants that may not have completed enlistment.
-- This remains separate from roster because roster represents formally accepted members.

create table if not exists personnel (
  id uuid primary key default gen_random_uuid(),
  roblox_username text not null unique,
  rank text not null default 'Unranked',
  unit text not null default 'Unassigned',
  last_rank_sync_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table personnel enable row level security;

grant usage on schema public to authenticated;
grant select on table public.personnel to authenticated;
grant insert, update, delete on table public.personnel to authenticated;

drop policy if exists personnel_select_public on personnel;
create policy personnel_select_public on personnel
  for select using (true);

drop policy if exists personnel_staff_manage on personnel;
create policy personnel_staff_manage on personnel
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
