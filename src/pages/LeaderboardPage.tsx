import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';

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

  const aggregateByCutoff = (cutoff: Date | null) => {
    const map = new Map<string, LeaderEntry & { battleIds: Set<string> }>();
    logs.forEach((log) => {
      const date = resolveLogDate(log);
      if (!date || (cutoff && date < cutoff)) {
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

  const aggregate = (period: 'weekly' | 'monthly') => {
    const now = new Date();
    const weeklyCutoff = new Date(now);
    weeklyCutoff.setDate(now.getDate() - 7);
    const monthlyCutoff = new Date(now.getFullYear(), now.getMonth(), 1);
    const cutoff = period === 'weekly' ? weeklyCutoff : monthlyCutoff;

    const filtered = aggregateByCutoff(cutoff);
    if (filtered.length > 0 || logs.length === 0) {
      return filtered;
    }

    return aggregateByCutoff(null);
  };

  const weekly = useMemo(() => aggregate('weekly'), [logs, battleDates]);
  const monthly = useMemo(() => aggregate('monthly'), [logs, battleDates]);

  const rankBoard = (board: LeaderEntry[]) => (
    [...board]
      .sort((a, b) => (Number(b[metric]) || 0) - (Number(a[metric]) || 0))
      .slice(0, 50)
  );

  const renderBoard = (title: string, board: LeaderEntry[]) => (
    <div className="rounded border border-slateBlue/70 bg-[#141a24] p-6">
      <h3 className="text-lg font-semibold uppercase tracking-[0.3em] text-silver">{title}</h3>
      <div className="mt-4 space-y-2">
        {rankBoard(board).length === 0 ? (
          <p className="text-sm text-slate-400">No data logged yet.</p>
        ) : rankBoard(board).map((entry, index) => (
          <div key={`${entry.name}-${entry.unit}`} className="flex items-center justify-between rounded border border-slateBlue/60 px-3 py-2 text-sm">
            <div className="text-slate-300">{index + 1}. {entry.name} <span className="text-slate-500">({entry.unit})</span></div>
            <div className="text-right">
              <div className="text-silver">{metric.toUpperCase()} {entry[metric]}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <section className="space-y-6">
      <div className="rounded border border-slateBlue/70 bg-[#141a24] p-6">
        <div className="text-[10px] uppercase tracking-[0.35em] text-slate-400">Performance</div>
        <h2 className="mt-2 text-3xl font-semibold uppercase tracking-[0.2em] text-silver">Leaderboard</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" onClick={() => setMetric('kills')} className={`rounded border px-3 py-2 text-xs uppercase tracking-[0.3em] ${metric === 'kills' ? 'border-silver/50 bg-silver text-slateBlue' : 'border-slateBlue/70 text-silver'}`}>Kills</button>
          <button type="button" onClick={() => setMetric('deaths')} className={`rounded border px-3 py-2 text-xs uppercase tracking-[0.3em] ${metric === 'deaths' ? 'border-silver/50 bg-silver text-slateBlue' : 'border-slateBlue/70 text-silver'}`}>Deaths</button>
          <button type="button" onClick={() => setMetric('assists')} className={`rounded border px-3 py-2 text-xs uppercase tracking-[0.3em] ${metric === 'assists' ? 'border-silver/50 bg-silver text-slateBlue' : 'border-slateBlue/70 text-silver'}`}>Assists</button>
          <button type="button" onClick={() => setMetric('events')} className={`rounded border px-3 py-2 text-xs uppercase tracking-[0.3em] ${metric === 'events' ? 'border-silver/50 bg-silver text-slateBlue' : 'border-slateBlue/70 text-silver'}`}>Events Attended</button>
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {renderBoard(`Weekly ${metricLabels[metric]}`, weekly)}
        {renderBoard(`Monthly ${metricLabels[metric]}`, monthly)}
      </div>
    </section>
  );
}