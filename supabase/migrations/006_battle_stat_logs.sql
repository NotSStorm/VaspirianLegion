-- Structured battle stat logs used for editable K/D/A sheets, leaderboard rollups, and rally attendance metrics.

create table if not exists battle_stat_logs (
  id uuid primary key default gen_random_uuid(),
  battle_id uuid not null references battles(id) on delete cascade,
  profile_id uuid references profiles(id) on delete set null,
  participant_name text not null,
  unit text not null default 'Unassigned',
  kills int not null default 0,
  deaths int not null default 0,
  assists int not null default 0,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table battle_stat_logs enable row level security;

grant usage on schema public to authenticated;
grant select on table public.battle_stat_logs to authenticated;
grant insert, update, delete on table public.battle_stat_logs to authenticated;

drop policy if exists battle_stat_logs_select_public on battle_stat_logs;
create policy battle_stat_logs_select_public on battle_stat_logs
  for select using (true);

drop policy if exists battle_stat_logs_staff_manage on battle_stat_logs;
create policy battle_stat_logs_staff_manage on battle_stat_logs
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
