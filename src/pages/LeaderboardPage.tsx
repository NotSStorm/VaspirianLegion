import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { isInTimeWindow, type TimeWindow } from '../lib/timeWindows';

type Battle = {
  id: string;
  start_date: string;
};

type StatLog = {
  id: string;
  battle_id: string;
  participant_name: string;
  unit: string;
  kills: number;
  deaths: number;
  assists: number;
  created_at: string;
};

type LeaderEntry = {
  name: string;
  unit: string;
  kills: number;
  deaths: number;
  assists: number;
  events: number;
};

type Metric = 'kills' | 'deaths' | 'assists' | 'events';

const metricLabels: Record<Metric, string> = {
  kills: 'Kills',
  deaths: 'Deaths',
  assists: 'Assists',
  events: 'Events Attended'
};

export default function LeaderboardPage() {
  const [logs, setLogs] = useState<StatLog[]>([]);
  const [battleDates, setBattleDates] = useState<Map<string, Date>>(new Map());
  const [metric, setMetric] = useState<Metric>('kills');

  const resolveLogDate = (log: StatLog) => {
    const battleDate = battleDates.get(log.battle_id);
    if (battleDate && !Number.isNaN(battleDate.getTime())) {
      return battleDate;
    }

    const createdAt = new Date(log.created_at);
    if (!Number.isNaN(createdAt.getTime())) {
      return createdAt;
    }

    return null;
  };

  useEffect(() => {
    const load = async () => {
      const [{ data: statData }, { data: battleData }] = await Promise.all([
        supabase
          .from('battle_stat_logs')
          .select('id, battle_id, participant_name, unit, kills, deaths, assists, created_at'),
        supabase.from('battles').select('id, start_date')
      ]);

      setLogs((statData || []) as StatLog[]);
      const dateMap = new Map<string, Date>();
      ((battleData || []) as Battle[]).forEach((battle) => {
        const parsed = new Date(battle.start_date);
        if (!Number.isNaN(parsed.getTime())) {
          dateMap.set(battle.id, parsed);
        }
      });
      setBattleDates(dateMap);
    };

    void load();

    const channel = supabase
      .channel('leaderboard-live-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'battle_stat_logs' }, () => {
        void load();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'battles' }, () => {
        void load();
      })
      .subscribe();

    const pollId = window.setInterval(() => {
      void load();
    }, 20000);

    return () => {
      window.clearInterval(pollId);
      void supabase.removeChannel(channel);
    };
  }, []);

  const aggregateByWindow = (selectedWindow: TimeWindow) => {
    const now = new Date();
    const map = new Map<string, LeaderEntry & { battleIds: Set<string> }>();
    logs.forEach((log) => {
      const date = resolveLogDate(log);
      if (!date || !isInTimeWindow(date, selectedWindow, now)) {
        return;
      }

      const key = `${log.participant_name}::${log.unit}`;
      const existing = map.get(key) || {
        name: log.participant_name,
        unit: log.unit,
        kills: 0,
        deaths: 0,
        assists: 0,
        events: 0,
        battleIds: new Set<string>()
      };

      existing.kills += Number(log.kills) || 0;
      existing.deaths += Number(log.deaths) || 0;
      existing.assists += Number(log.assists) || 0;
      existing.battleIds.add(log.battle_id);
      map.set(key, existing);
    });

    return Array.from(map.values()).map(({ battleIds, ...entry }) => ({
      ...entry,
      events: battleIds.size
    }));
  };

  const boardByWindow = useMemo(() => ({
    weekly: aggregateByWindow('weekly'),
    monthly: aggregateByWindow('monthly'),
    'all-time': aggregateByWindow('all-time')
  }), [logs, battleDates]);

  const rankBoard = (entries: LeaderEntry[], metric: Metric) => (
    [...entries]
      .sort((a, b) => (Number(b[metric]) || 0) - (Number(a[metric]) || 0))
      .slice(0, 10)
  );

  const windowLabel: Record<TimeWindow, string> = {
    weekly: 'Weekly',
    monthly: 'Monthly',
    'all-time': 'All Time'
  };

  const metricTabs: Array<{ key: Metric; label: string }> = [
    { key: 'kills', label: 'Kills' },
    { key: 'deaths', label: 'Deaths' },
    { key: 'assists', label: 'Assists' },
    { key: 'events', label: 'Events Attended' }
  ];

  const windowOrder: TimeWindow[] = ['weekly', 'monthly', 'all-time'];

  const renderRow = (entry: LeaderEntry, index: number) => {
    const isPodium = index < 3;

    return (
      <div key={`${entry.name}-${entry.unit}-${index}`} className="flex items-center justify-between gap-3 rounded border border-slateBlue/50 bg-[#0d121b] px-3 py-2">
        <div className={`truncate ${isPodium ? 'text-sm font-semibold text-silver' : 'text-xs text-slate-300'}`}>
          <span className={isPodium ? 'text-slate-200' : 'text-slate-400'}>#{index + 1}</span>
          <span className="ml-2">{entry.name}</span>
          <span className="ml-1 text-slate-500">({entry.unit || 'Unassigned'})</span>
        </div>
        <div className={`shrink-0 text-right uppercase tracking-[0.14em] ${isPodium ? 'text-xl font-semibold text-silver' : 'text-xs font-medium text-slate-300'}`}>
          {entry[metric]} {metricLabels[metric]}
        </div>
      </div>
    );
  };

  const renderWindowColumn = (window: TimeWindow) => {
    const ranked = rankBoard(boardByWindow[window], metric);

    return (
      <div key={window} className="rounded border border-slateBlue/70 bg-[#141a24] p-4">
        <h3 className="text-sm font-semibold uppercase tracking-[0.3em] text-silver">{windowLabel[window]}</h3>
        <div className="mt-3 space-y-2">
          {ranked.length === 0 ? (
            <p className="text-sm text-slate-400">No data logged yet.</p>
          ) : ranked.map((entry, index) => renderRow(entry, index))}
        </div>
      </div>
    );
  };

  return (
    <section className="space-y-6">
      <div className="rounded border border-slateBlue/70 bg-[#141a24] p-6">
        <div className="text-[10px] uppercase tracking-[0.35em] text-slate-400">Performance</div>
        <h2 className="mt-2 text-3xl font-semibold uppercase tracking-[0.2em] text-silver">Leaderboard</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          {metricTabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setMetric(tab.key)}
              className={`rounded border px-3 py-2 text-xs uppercase tracking-[0.3em] ${metric === tab.key ? 'border-silver/50 bg-silver text-slateBlue' : 'border-slateBlue/70 text-silver'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        {windowOrder.map((window) => renderWindowColumn(window))}
      </div>
    </section>
  );
}