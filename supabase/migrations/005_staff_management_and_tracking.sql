-- Staff management and tracking features.
-- Adds schedule, battle logs, performance leaderboard, and rally tracker tables.
-- Also grants officers/admins write access to command slots, battles, and medals.

create table if not exists schedule_events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  classification text not null default 'Public',
  status text not null default 'Pending',
  theater text not null,
  commanding_officer text not null,
  personnel_count int not null default 0,
  start_date text not null,
  threat_level int not null default 1,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists battle_logs (
  id uuid primary key default gen_random_uuid(),
  battle_id uuid not null references battles(id) on delete cascade,
  log_entry text not null,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists performance_logs (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  logged_on date not null,
  period text not null check (period in ('weekly', 'monthly')),
  total int not null default 0,
  kills int not null default 0,
  deaths int not null default 0,
  assists int not null default 0,
  company text,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists rally_events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  occurred_on date not null,
  company text not null,
  region text,
  notes text,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists rally_attendance (
  event_id uuid not null references rally_events(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  present boolean not null default true,
  assigned_role text,
  created_at timestamptz not null default now(),
  primary key (event_id, profile_id)
);

alter table schedule_events enable row level security;
alter table battle_logs enable row level security;
alter table performance_logs enable row level security;
alter table rally_events enable row level security;
alter table rally_attendance enable row level security;

grant usage on schema public to authenticated;
grant select on table public.command_slots, public.battles, public.medals, public.schedule_events, public.battle_logs, public.performance_logs, public.rally_events, public.rally_attendance to authenticated;
grant insert, update, delete on table public.command_slots, public.battles, public.medals, public.schedule_events, public.battle_logs, public.performance_logs, public.rally_events, public.rally_attendance to authenticated;

drop policy if exists command_slots_staff_manage on command_slots;
create policy command_slots_staff_manage on command_slots
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

drop policy if exists battles_staff_manage on battles;
create policy battles_staff_manage on battles
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

drop policy if exists medals_staff_manage on medals;
create policy medals_staff_manage on medals
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

drop policy if exists schedule_events_select_public on schedule_events;
create policy schedule_events_select_public on schedule_events
  for select using (true);

drop policy if exists schedule_events_staff_manage on schedule_events;
create policy schedule_events_staff_manage on schedule_events
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

drop policy if exists battle_logs_select_public on battle_logs;
create policy battle_logs_select_public on battle_logs
  for select using (true);

drop policy if exists battle_logs_staff_manage on battle_logs;
create policy battle_logs_staff_manage on battle_logs
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

drop policy if exists performance_logs_select_public on performance_logs;
create policy performance_logs_select_public on performance_logs
  for select using (true);

drop policy if exists performance_logs_staff_manage on performance_logs;
create policy performance_logs_staff_manage on performance_logs
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

drop policy if exists rally_events_select_public on rally_events;
create policy rally_events_select_public on rally_events
  for select using (true);

drop policy if exists rally_events_staff_manage on rally_events;
create policy rally_events_staff_manage on rally_events
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

drop policy if exists rally_attendance_select_public on rally_attendance;
create policy rally_attendance_select_public on rally_attendance
  for select using (true);

drop policy if exists rally_attendance_staff_manage on rally_attendance;
create policy rally_attendance_staff_manage on rally_attendance
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
