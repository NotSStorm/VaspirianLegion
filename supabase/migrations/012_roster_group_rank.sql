alter table roster
  add column if not exists group_rank text,
  add column if not exists last_group_rank_sync_at timestamptz;