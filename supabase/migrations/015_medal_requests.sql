create table if not exists medal_requests (
  id uuid primary key default gen_random_uuid(),
  requester_profile_id uuid not null references profiles(id) on delete cascade,
  medal_name text not null,
  request_note text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid references profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table medal_requests enable row level security;

grant usage on schema public to authenticated;
grant select, insert, update on table public.medal_requests to authenticated;

drop policy if exists "Users can insert their own medal requests" on medal_requests;
create policy "Users can insert their own medal requests"
on medal_requests for insert
to authenticated
with check (auth.uid() = requester_profile_id);

drop policy if exists "Users can view their own medal requests" on medal_requests;
create policy "Users can view their own medal requests"
on medal_requests for select
to authenticated
using (auth.uid() = requester_profile_id);

drop policy if exists "Officers and admins can view all medal requests" on medal_requests;
create policy "Officers and admins can view all medal requests"
on medal_requests for select
to authenticated
using (
  exists (
    select 1 from profiles
    where profiles.id = auth.uid()
      and profiles.role in ('officer', 'admin')
  )
);

drop policy if exists "Officers and admins can update medal requests" on medal_requests;
create policy "Officers and admins can update medal requests"
on medal_requests for update
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
