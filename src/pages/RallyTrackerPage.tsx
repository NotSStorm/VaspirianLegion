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
  created_at: string;
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
        supabase.from('battle_stat_logs').select('battle_id, participant_name, unit, kills, deaths, assists, created_at')
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

      const resolveDate = (entry: StatLog) => {
        const battle = battleMap.get(entry.battle_id);
        const battleDate = battle ? new Date(battle.start_date) : null;
        if (battleDate && !Number.isNaN(battleDate.getTime())) {
          return battleDate;
        }

        const createdAt = new Date(entry.created_at);
        if (!Number.isNaN(createdAt.getTime())) {
          return createdAt;
        }

        return null;
      };

      const buildPoints = (selectedCutoff: Date | null) => {
        const grouped = new Map<string, { melrose: Set<string>; pirkland: Set<string>; total: Set<string> }>();
        ((logs || []) as StatLog[]).forEach((entry) => {
          const date = resolveDate(entry);
          if (!date || (selectedCutoff && date < selectedCutoff)) return;

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

        return Array.from(grouped.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([date, value]) => ({
            date,
            melrose: value.melrose.size,
            pirkland: value.pirkland.size,
            total: value.total.size
          }));
      };

      const resolved = buildPoints(cutoff);

      setPoints(resolved.length > 0 || (logs || []).length === 0 ? resolved : buildPoints(null));
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
        const x = points.length === 1 ? 50 : 8 + (index / Math.max(points.length - 1, 1)) * 84;
        const y = 90 - (selector(point) / maxY) * 72;
        return `${x},${y}`;
      })
      .join(' ');
  };

  const pointCoordinates = (selector: (point: TrendPoint) => number) => points.map((point, index) => ({
    x: points.length === 1 ? 50 : 8 + (index / Math.max(points.length - 1, 1)) * 84,
    y: 90 - (selector(point) / maxY) * 72,
    value: selector(point)
  }));

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
            <div className="mb-3 flex flex-wrap gap-4 text-xs uppercase tracking-[0.3em] text-slate-300">
              <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-white" /> Total</span>
              <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-blue-400" /> Pirkland</span>
              <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-fuchsia-400" /> Melrose</span>
            </div>
            <svg viewBox="0 0 100 100" className="h-64 w-full rounded border border-slateBlue/60 bg-[#0d121b] p-2">
              {[0, 25, 50, 75, 100].map((_, index) => (
                <line key={index} x1="4" y1={10 + index * 20} x2="96" y2={10 + index * 20} stroke="rgba(148, 163, 184, 0.18)" strokeWidth="0.5" />
              ))}
              <polyline fill="none" stroke="#ffffff" strokeWidth="1.7" strokeDasharray="1.5 1.2" points={toPolyline((point) => point.total)} />
              <polyline fill="none" stroke="#60a5fa" strokeWidth="1.7" points={toPolyline((point) => point.pirkland)} />
              <polyline fill="none" stroke="#d946ef" strokeWidth="1.7" points={toPolyline((point) => point.melrose)} />

              {pointCoordinates((point) => point.total).map((point, index) => (
                <g key={`total-${index}`}>
                  <circle cx={point.x} cy={point.y} r="1.3" fill="#ffffff" />
                  <text x={point.x} y={point.y - 3} textAnchor="middle" fontSize="4" fill="#ffffff">{point.value}</text>
                </g>
              ))}
              {pointCoordinates((point) => point.pirkland).map((point, index) => (
                <g key={`pirkland-${index}`}>
                  <circle cx={point.x} cy={point.y} r="1.2" fill="#60a5fa" />
                  <text x={point.x} y={point.y - 3} textAnchor="middle" fontSize="3.6" fill="#60a5fa">{point.value}</text>
                </g>
              ))}
              {pointCoordinates((point) => point.melrose).map((point, index) => (
                <g key={`melrose-${index}`}>
                  <circle cx={point.x} cy={point.y} r="1.2" fill="#d946ef" />
                  <text x={point.x} y={point.y - 3} textAnchor="middle" fontSize="3.6" fill="#d946ef">{point.value}</text>
                </g>
              ))}
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