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
  const [timeWindow, setTimeWindow] = useState<TimeWindow>('weekly');

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

  const board = useMemo(() => aggregateByWindow(timeWindow), [logs, battleDates, timeWindow]);

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

  const renderMetricBoard = (metric: Metric) => {
    const ranked = rankBoard(board, metric);

    return (
      <div className="rounded border border-slateBlue/70 bg-[#141a24] p-6">
        <h3 className="text-lg font-semibold uppercase tracking-[0.3em] text-silver">{windowLabel[timeWindow]} {metricLabels[metric]}</h3>
        <div className="mt-4 space-y-3">
          {ranked.length === 0 ? (
            <p className="text-sm text-slate-400">No data logged yet.</p>
          ) : ranked.map((entry, index) => (
            <div key={`${metric}-${entry.name}-${entry.unit}`} className="rounded border border-slateBlue/60 bg-[#0d121b] px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="text-xs uppercase tracking-[0.25em] text-slate-400">#{index + 1}</div>
                <div className="text-right">
                  <div className="text-2xl font-semibold uppercase tracking-[0.08em] text-silver">{entry[metric]}</div>
                  <div className="text-[11px] uppercase tracking-[0.25em] text-slate-400">{metricLabels[metric]}</div>
                </div>
              </div>
              <div className="mt-2 text-sm text-slate-300">{entry.name} <span className="text-slate-500">({entry.unit})</span></div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderWindowButton = (value: TimeWindow, label: string) => (
    <button
      type="button"
      onClick={() => setTimeWindow(value)}
      className={`rounded border px-3 py-2 text-xs uppercase tracking-[0.3em] ${timeWindow === value ? 'border-silver/50 bg-silver text-slateBlue' : 'border-slateBlue/70 text-silver'}`}
    >
      {label}
    </button>
  );

  return (
    <section className="space-y-6">
      <div className="rounded border border-slateBlue/70 bg-[#141a24] p-6">
        <div className="text-[10px] uppercase tracking-[0.35em] text-slate-400">Performance</div>
        <h2 className="mt-2 text-3xl font-semibold uppercase tracking-[0.2em] text-silver">Leaderboard</h2>
        <p className="mt-2 text-sm text-slate-300">Weekly = last 7 days, Monthly = last 30 days, All Time = full record.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {renderWindowButton('weekly', 'Weekly')}
          {renderWindowButton('monthly', 'Monthly')}
          {renderWindowButton('all-time', 'All Time')}
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        {renderMetricBoard('kills')}
        {renderMetricBoard('deaths')}
        {renderMetricBoard('assists')}
      </div>
    </section>
  );
}