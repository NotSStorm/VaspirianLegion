-- Allow signed-out visitors to read tables already covered by public SELECT RLS policies.
-- Without these grants, anon users hit "permission denied" / "Unable to load ..." on public pages.

grant usage on schema public to anon;

grant select on table public.profiles to anon;
grant select on table public.roster to anon;
grant select on table public.roster_qualifications to anon;
grant select on table public.battles to anon;
grant select on table public.medals to anon;
grant select on table public.lore_timeline to anon;
grant select on table public.command_slots to anon;
grant select on table public.site_settings to anon;
grant select on table public.schedule_events to anon;
grant select on table public.battle_logs to anon;
grant select on table public.performance_logs to anon;
grant select on table public.rally_events to anon;
grant select on table public.rally_attendance to anon;
grant select on table public.battle_stat_logs to anon;