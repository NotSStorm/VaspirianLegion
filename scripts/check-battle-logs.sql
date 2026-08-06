-- Replace the battle name or date filter as needed.
-- This returns the battle row plus the number of linked stat logs.

select
  b.id,
  b.name,
  b.status,
  b.classification,
  b.start_date,
  b.personnel_count,
  b.threat_level,
  count(l.id) as log_count
from battles b
left join battle_stat_logs l
  on l.battle_id = b.id
where b.start_date ilike '%5 aug%'
   or b.start_date ilike '%05 aug%'
   or b.start_date ilike '%2026-08-05%'
group by
  b.id,
  b.name,
  b.status,
  b.classification,
  b.start_date,
  b.personnel_count,
  b.threat_level
order by b.start_date desc;

-- If you know the battle id, use this instead:
-- select * from battle_stat_logs where battle_id = 'YOUR-BATTLE-ID-HERE' order by created_at asc;

-- Diagnostics for "logs created today but not showing".
-- This highlights logs from the last 7 days and whether their linked battle date
-- would pass the frontend weekly filter (which uses battle.start_date first).
with recent_logs as (
  select
    l.id as log_id,
    l.battle_id,
    l.participant_name,
    l.unit,
    l.created_at,
    b.name as battle_name,
    b.start_date,
    case
      when b.start_date ~ '^\\d{4}-\\d{2}-\\d{2}$' then to_date(b.start_date, 'YYYY-MM-DD')
      when b.start_date ~ '^\\d{1,2} [A-Za-z]{3} \\d{4}$' then to_date(b.start_date, 'DD Mon YYYY')
      when b.start_date ~ '^\\d{1,2} [A-Za-z]+ \\d{4}$' then to_date(b.start_date, 'DD Month YYYY')
      else null
    end as parsed_battle_date
  from battle_stat_logs l
  left join battles b on b.id = l.battle_id
  where l.created_at >= now() - interval '7 days'
)
select
  log_id,
  battle_id,
  battle_name,
  start_date,
  created_at,
  parsed_battle_date,
  case
    when parsed_battle_date is null then 'battle date parse failed -> frontend falls back to created_at'
    when parsed_battle_date >= current_date - interval '7 days' then 'included by weekly battle-date filter'
    else 'excluded: battle date is outside weekly window even though log is recent'
  end as weekly_diagnosis
from recent_logs
order by created_at desc;

-- Orphan logs (battle_id exists in logs but not in battles): should normally be zero.
select l.id as log_id, l.battle_id, l.participant_name, l.created_at
from battle_stat_logs l
left join battles b on b.id = l.battle_id
where b.id is null
order by l.created_at desc;