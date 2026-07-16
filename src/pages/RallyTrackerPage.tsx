import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';

type Battle = {
  id: string;
  name: string;
  start_date: string;
};

type StatLog = {
  battle_id: string;
  participant_name: string;
  unit: string;
  kills: number;
  deaths: number;
  assists: number;
};

type TrendPoint = {
  date: string;
  melrose: number;
  pirkland: number;
  total: number;
};

function unitBucket(unit: string) {
  const lowered = unit.toLowerCase();
  if (lowered.includes('melrose') || lowered.includes('87th')) return 'melrose';
  if (lowered.includes('pirkland') || lowered.includes('82nd')) return 'pirkland';
  return 'other';
}

export default function RallyTrackerPage() {
  const [period, setPeriod] = useState<'weekly' | 'monthly'>('weekly');
  const [points, setPoints] = useState<TrendPoint[]>([]);

  useEffect(() => {
    const load = async () => {
      const [{ data: battles }, { data: logs }] = await Promise.all([
        supabase.from('battles').select('id, name, start_date').order('start_date', { ascending: true }),
        supabase.from('battle_stat_logs').select('battle_id, participant_name, unit, kills, deaths, assists')
      ]);

      const now = new Date();
      const cutoff = new Date(now);
      if (period === 'weekly') {
        cutoff.setDate(now.getDate() - 7);
      } else {
        cutoff.setDate(now.getDate() - 30);
      }

      const battleMap = new Map<string, Battle>();
      ((battles || []) as Battle[]).forEach((battle) => {
        battleMap.set(battle.id, battle);
      });

      const grouped = new Map<string, { melrose: Set<string>; pirkland: Set<string>; total: Set<string> }>();
      ((logs || []) as StatLog[]).forEach((entry) => {
        const battle = battleMap.get(entry.battle_id);
        if (!battle) return;
        const date = new Date(battle.start_date);
        if (Number.isNaN(date.getTime()) || date < cutoff) return;

        const key = date.toISOString().slice(0, 10);
        const existing = grouped.get(key) || { melrose: new Set<string>(), pirkland: new Set<string>(), total: new Set<string>() };
        const name = entry.participant_name.trim();
        if (!name) return;

        existing.total.add(name);
        const bucket = unitBucket(entry.unit || '');
        if (bucket === 'melrose') existing.melrose.add(name);
        if (bucket === 'pirkland') existing.pirkland.add(name);
        grouped.set(key, existing);
      });

      const resolved = Array.from(grouped.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, value]) => ({
          date,
          melrose: value.melrose.size,
          pirkland: value.pirkland.size,
          total: value.total.size
        }));

      setPoints(resolved);
    };

    void load();

    const channel = supabase
      .channel('rally-tracker-live-updates')
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
  }, [period]);

  const maxY = useMemo(() => {
    const top = points.reduce((max, point) => Math.max(max, point.total, point.melrose, point.pirkland), 0);
    return top > 0 ? top : 1;
  }, [points]);

  const toPolyline = (selector: (point: TrendPoint) => number) => {
    if (points.length === 0) return '';
    return points
      .map((point, index) => {
        const x = (index / Math.max(points.length - 1, 1)) * 100;
        const y = 100 - (selector(point) / maxY) * 100;
        return `${x},${y}`;
      })
      .join(' ');
  };

  return (
    <section className="space-y-6">
      <div className="rounded border border-slateBlue/70 bg-[#141a24] p-6">
        <div className="text-[10px] uppercase tracking-[0.35em] text-slate-400">Operations Attendance</div>
        <h2 className="mt-2 text-3xl font-semibold uppercase tracking-[0.2em] text-silver">Rally Tracker</h2>
        <div className="mt-4 flex gap-2">
          <button type="button" onClick={() => setPeriod('weekly')} className={`rounded border px-3 py-2 text-xs uppercase tracking-[0.3em] ${period === 'weekly' ? 'border-silver/50 bg-silver text-slateBlue' : 'border-slateBlue/70 text-silver'}`}>Weekly</button>
          <button type="button" onClick={() => setPeriod('monthly')} className={`rounded border px-3 py-2 text-xs uppercase tracking-[0.3em] ${period === 'monthly' ? 'border-silver/50 bg-silver text-slateBlue' : 'border-slateBlue/70 text-silver'}`}>Monthly</button>
        </div>
      </div>

      <div className="rounded border border-slateBlue/70 bg-[#141a24] p-6">
        {points.length === 0 ? (
          <p className="text-sm text-slate-400">No battle attendance logs in this period.</p>
        ) : (
          <>
            <div className="mb-3 text-xs uppercase tracking-[0.3em] text-slate-400">Attendance Lines: Melrose, Pirkland, Total</div>
            <svg viewBox="0 0 100 100" className="h-48 w-full rounded border border-slateBlue/60 bg-[#0d121b] p-2">
              <polyline fill="none" stroke="#34d399" strokeWidth="1.5" points={toPolyline((point) => point.melrose)} />
              <polyline fill="none" stroke="#60a5fa" strokeWidth="1.5" points={toPolyline((point) => point.pirkland)} />
              <polyline fill="none" stroke="#fbbf24" strokeWidth="1.5" points={toPolyline((point) => point.total)} />
            </svg>

            <div className="mt-4 overflow-auto rounded border border-slateBlue/60">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slateBlue/30 text-slate-200">
                  <tr>
                    <th className="px-3 py-2">Date</th>
                    <th className="px-3 py-2">Melrose</th>
                    <th className="px-3 py-2">Pirkland</th>
                    <th className="px-3 py-2">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {points.map((point) => (
                    <tr key={point.date} className="border-t border-slateBlue/40">
                      <td className="px-3 py-2 text-slate-300">{point.date}</td>
                      <td className="px-3 py-2 text-emerald-300">{point.melrose}</td>
                      <td className="px-3 py-2 text-blue-300">{point.pirkland}</td>
                      <td className="px-3 py-2 text-amber-300">{point.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </section>
  );
}