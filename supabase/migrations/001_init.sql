create extension if not exists pgcrypto;

create table if not exists profiles (
  id uuid primary key default gen_random_uuid(),
  discord_id text unique,
  discord_username text,
  roblox_id text,
  roblox_username text,
  role text not null default 'member' check (role in ('member','officer','admin')),
  callsign text,
  rank text,
  company text,
  roblox_verification_code text,
  roblox_verified_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists roster_qualifications (
  profile_id uuid references profiles(id) on delete cascade,
  tag text not null,
  primary key (profile_id, tag)
);

create table if not exists battles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  status text not null,
  classification text not null,
  theater text not null,
  commanding_officer text not null,
  personnel_count int not null default 0,
  threat_level int not null default 1,
  start_date text not null,
  description text not null,
  is_upcoming boolean not null default false,
  is_public boolean not null default true
);

create table if not exists medals (
  id uuid primary key default gen_random_uuid(),
  recipient_profile_id uuid references profiles(id) on delete set null,
  medal_name text not null,
  citation text not null,
  campaign_tag text not null,
  date_awarded text not null,
  status_tags text[] not null default '{}'
);

create table if not exists lore_timeline (
  id uuid primary key default gen_random_uuid(),
  year_label text not null,
  title text not null,
  description text not null,
  sort_order int not null default 0
);

create table if not exists command_slots (
  id uuid primary key default gen_random_uuid(),
  tier text not null,
  company text not null,
  slot_title text not null,
  profile_id uuid references profiles(id) on delete set null,
  sort_order int not null default 0
);

create table if not exists site_settings (
  key text primary key,
  value text not null
);

create table if not exists applications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references profiles(id) on delete cascade,
  service_number text not null,
  callsign text not null,
  timezone text not null,
  requested_group_join boolean not null default false,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  reviewed_by uuid references profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists roster (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references profiles(id) on delete cascade unique,
  rank text not null default 'CST',
  callsign text not null,
  company text,
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;
alter table roster_qualifications enable row level security;
alter table battles enable row level security;
alter table medals enable row level security;
alter table lore_timeline enable row level security;
alter table command_slots enable row level security;
alter table site_settings enable row level security;
alter table applications enable row level security;
alter table roster enable row level security;

create policy profiles_select_public on profiles
  for select using (true);

create policy profiles_manage_admin on profiles
  for all using (auth.role() = 'authenticated');

create policy roster_qualifications_select_public on roster_qualifications
  for select using (true);

create policy battles_select_public on battles
  for select using (true);

create policy medals_select_public on medals
  for select using (true);

create policy lore_timeline_select_public on lore_timeline
  for select using (true);

create policy command_slots_select_public on command_slots
  for select using (true);

create policy site_settings_select_public on site_settings
  for select using (true);

create policy applications_select_owner on applications
  for select using (auth.uid() = profile_id);

create policy roster_select_public on roster
  for select using (true);
