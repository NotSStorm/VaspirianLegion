-- Applications RLS and grants for enlistment submissions and HR review.

grant usage on schema public to authenticated;
grant select, insert, update on table public.applications to authenticated;

drop policy if exists applications_insert_owner on applications;
drop policy if exists applications_select_owner on applications;
drop policy if exists "Users can insert their own applications" on applications;
drop policy if exists "Users can view their own applications" on applications;
drop policy if exists "Officers and admins can view all applications" on applications;
drop policy if exists "Officers and admins can update applications" on applications;

create policy "Users can insert their own applications"
on applications for insert
to authenticated
with check (auth.uid() = profile_id);

create policy "Users can view their own applications"
on applications for select
to authenticated
using (auth.uid() = profile_id);

create policy "Officers and admins can view all applications"
on applications for select
to authenticated
using (
  exists (
    select 1 from profiles
    where profiles.id = auth.uid()
      and profiles.role in ('officer', 'admin')
  )
);

create policy "Officers and admins can update applications"
on applications for update
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
