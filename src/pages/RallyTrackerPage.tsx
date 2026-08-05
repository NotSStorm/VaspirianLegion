import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { isInTimeWindow, type TimeWindow } from '../lib/timeWindows';

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

type RallyView = 'total' | 'company';

type HoverPoint = {
  x: number;
  y: number;
  date: string;
  label: string;
  value: number;
};

function unitBucket(unit: string) {
  const lowered = unit.toLowerCase();
  if (lowered.includes('melrose') || lowered.includes('87th')) return 'melrose';
  if (lowered.includes('pirkland') || lowered.includes('82nd')) return 'pirkland';
  return 'other';
}

export default function RallyTrackerPage() {
  const [period, setPeriod] = useState<TimeWindow>('weekly');
  const [view, setView] = useState<RallyView>('total');
  const [points, setPoints] = useState<TrendPoint[]>([]);
  const [hoverPoint, setHoverPoint] = useState<HoverPoint | null>(null);

  const load = useCallback(async () => {
    const [{ data: battles }, { data: logs }] = await Promise.all([
      supabase.from('battles').select('id, name, start_date').order('start_date', { ascending: true }),
      supabase.from('battle_stat_logs').select('battle_id, participant_name, unit, kills, deaths, assists, created_at')
    ]);

    const now = new Date();

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

    const buildPoints = (selectedPeriod: TimeWindow) => {
      const grouped = new Map<string, { melrose: Set<string>; pirkland: Set<string>; total: Set<string> }>();
      ((logs || []) as StatLog[]).forEach((entry) => {
        const date = resolveDate(entry);
        if (!date || !isInTimeWindow(date, selectedPeriod, now)) return;

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

    setPoints(buildPoints(period));
  }, [period]);

  useEffect(() => {

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
  }, [load]);

  const parsedPoints = useMemo(
    () => points.map((point) => ({ ...point, parsedDate: new Date(`${point.date}T00:00:00Z`) })),
    [points]
  );

  const yMax = useMemo(() => {
    const top = parsedPoints.reduce((max, point) => {
      if (view === 'total') {
        return Math.max(max, point.total);
      }
      return Math.max(max, point.melrose, point.pirkland);
    }, 0);

    if (top <= 5) {
      return 5;
    }

    return Math.ceil(top / 5) * 5;
  }, [parsedPoints, view]);

  const chartArea = {
    width: 1200,
    height: 500,
    marginTop: 72,
    marginRight: 28,
    marginBottom: 56,
    marginLeft: 60
  };

  const plotWidth = chartArea.width - chartArea.marginLeft - chartArea.marginRight;
  const plotHeight = chartArea.height - chartArea.marginTop - chartArea.marginBottom;

  const firstDate = parsedPoints[0]?.parsedDate || null;
  const lastDate = parsedPoints[parsedPoints.length - 1]?.parsedDate || null;

  const xForDate = (date: Date) => {
    if (!firstDate || !lastDate) {
      return chartArea.marginLeft;
    }

    const span = Math.max(lastDate.getTime() - firstDate.getTime(), 1);
    const t = (date.getTime() - firstDate.getTime()) / span;
    return chartArea.marginLeft + t * plotWidth;
  };

  const yForValue = (value: number) => {
    const clamped = Math.max(0, Math.min(yMax, value));
    return chartArea.marginTop + (1 - clamped / Math.max(yMax, 1)) * plotHeight;
  };

  const monthlyTicks = useMemo(() => {
    if (!firstDate || !lastDate) {
      return [] as Date[];
    }

    const ticks: Date[] = [];
    const cursor = new Date(Date.UTC(firstDate.getUTCFullYear(), firstDate.getUTCMonth(), 1));
    const end = new Date(Date.UTC(lastDate.getUTCFullYear(), lastDate.getUTCMonth(), 1));

    while (cursor.getTime() <= end.getTime()) {
      ticks.push(new Date(cursor));
      cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    }

    return ticks;
  }, [firstDate, lastDate]);

  const yTicks = useMemo(() => {
    const tickCount = yMax <= 10 ? 5 : 6;
    const step = Math.max(1, Math.round(yMax / tickCount));
    const ticks: number[] = [];
    for (let value = 0; value <= yMax; value += step) {
      ticks.push(value);
    }
    if (ticks[ticks.length - 1] !== yMax) {
      ticks.push(yMax);
    }
    return ticks;
  }, [yMax]);

  const seriesPoints = (selector: (point: TrendPoint) => number) => parsedPoints.map((point) => ({
    x: xForDate(point.parsedDate),
    y: yForValue(selector(point)),
    value: selector(point),
    date: point.date
  }));

  const toSmoothPath = (linePoints: Array<{ x: number; y: number }>) => {
    if (linePoints.length === 0) return '';
    if (linePoints.length === 1) return `M ${linePoints[0].x} ${linePoints[0].y}`;

    let path = `M ${linePoints[0].x} ${linePoints[0].y}`;
    for (let i = 0; i < linePoints.length - 1; i += 1) {
      const p0 = linePoints[i - 1] || linePoints[i];
      const p1 = linePoints[i];
      const p2 = linePoints[i + 1];
      const p3 = linePoints[i + 2] || p2;

      const c1x = p1.x + (p2.x - p0.x) / 6;
      const c1y = p1.y + (p2.y - p0.y) / 6;
      const c2x = p2.x - (p3.x - p1.x) / 6;
      const c2y = p2.y - (p3.y - p1.y) / 6;

      path += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`;
    }

    return path;
  };

  const totalSeries = seriesPoints((point) => point.total);
  const pirklandSeries = seriesPoints((point) => point.pirkland);
  const melroseSeries = seriesPoints((point) => point.melrose);

  const formatTickDate = (date: Date) => `${date.getUTCMonth() + 1}/${date.getUTCDate()}/${date.getUTCFullYear()}`;
  const visibleMonthlyTicks = useMemo(() => {
    if (monthlyTicks.length <= 6) {
      return monthlyTicks;
    }

    const step = Math.ceil(monthlyTicks.length / 6);
    return monthlyTicks.filter((_, index) => index % step === 0 || index === monthlyTicks.length - 1);
  }, [monthlyTicks]);

  const totalTableRows = parsedPoints.map((point) => ({
    date: point.date,
    total: point.total
  }));

  return (
    <section className="space-y-6">
      <div className="rounded border border-slateBlue/70 bg-[#141a24] p-6">
        <div className="text-[10px] uppercase tracking-[0.35em] text-slate-400">Operations Attendance</div>
        <h2 className="mt-2 text-3xl font-semibold uppercase tracking-[0.2em] text-silver">Rally Tracker</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" onClick={() => setPeriod('weekly')} className={`rounded border px-3 py-2 text-xs uppercase tracking-[0.3em] ${period === 'weekly' ? 'border-silver/50 bg-silver text-slateBlue' : 'border-slateBlue/70 text-silver'}`}>Weekly</button>
          <button type="button" onClick={() => setPeriod('monthly')} className={`rounded border px-3 py-2 text-xs uppercase tracking-[0.3em] ${period === 'monthly' ? 'border-silver/50 bg-silver text-slateBlue' : 'border-slateBlue/70 text-silver'}`}>Monthly</button>
          <button type="button" onClick={() => setPeriod('all-time')} className={`rounded border px-3 py-2 text-xs uppercase tracking-[0.3em] ${period === 'all-time' ? 'border-silver/50 bg-silver text-slateBlue' : 'border-slateBlue/70 text-silver'}`}>All Time</button>
        </div>
      </div>

      <div className="rounded border border-slateBlue/70 bg-[#141a24] p-6">
        {parsedPoints.length === 0 ? (
          <p className="text-sm text-slate-400">No battle attendance logs in this period.</p>
        ) : (
          <>
            <div className="mb-4 inline-flex rounded border border-slateBlue/60 bg-[#0d121b] p-1 text-xs uppercase tracking-[0.25em]">
              <button
                type="button"
                onClick={() => setView('total')}
                className={`rounded px-3 py-2 transition ${view === 'total' ? 'bg-silver text-slateBlue' : 'text-slate-300'}`}
              >
                Total
              </button>
              <button
                type="button"
                onClick={() => setView('company')}
                className={`rounded px-3 py-2 transition ${view === 'company' ? 'bg-silver text-slateBlue' : 'text-slate-300'}`}
              >
                Company
              </button>
            </div>

            <div className="relative w-full pb-2">
              {hoverPoint && (
                <div
                  className="pointer-events-none absolute z-10 rounded border border-slateBlue/60 bg-[#0d121b] px-3 py-2 text-xs text-slate-200 shadow-lg"
                  style={{
                    left: `${(hoverPoint.x / chartArea.width) * 100}%`,
                    top: `${(hoverPoint.y / chartArea.height) * 100}%`,
                    transform: 'translate(-50%, calc(-100% - 12px))'
                  }}
                >
                  <div className="font-semibold text-silver">{hoverPoint.label}</div>
                  <div className="mt-1">Date: {hoverPoint.date}</div>
                  <div>Value: {hoverPoint.value}</div>
                </div>
              )}
              <svg
                viewBox={`0 0 ${chartArea.width} ${chartArea.height}`}
                preserveAspectRatio="xMidYMid meet"
                className="block aspect-[12/5] w-full rounded border border-[#8da1c7]/70 bg-[#b8c8df]"
              >
                <text x={24} y={30} fill="#6b7280" fontSize="18" fontWeight="700">Grand Battery Rallies</text>

                {yTicks.map((tick) => {
                  const y = yForValue(tick);
                  return (
                    <g key={`y-${tick}`}>
                      <line x1={chartArea.marginLeft} y1={y} x2={chartArea.width - chartArea.marginRight} y2={y} stroke="rgba(71, 85, 105, 0.35)" strokeWidth="1" />
                      <text x={chartArea.marginLeft - 12} y={y + 4} textAnchor="end" fill="#111827" fontSize="11" fontWeight="600">{tick}</text>
                    </g>
                  );
                })}

                {visibleMonthlyTicks.map((tick) => {
                  const x = xForDate(tick);
                  return (
                    <g key={`x-${tick.toISOString()}`}>
                      <line x1={x} y1={chartArea.marginTop} x2={x} y2={chartArea.height - chartArea.marginBottom} stroke="rgba(71, 85, 105, 0.22)" strokeWidth="1" />
                      <text x={x} y={chartArea.height - chartArea.marginBottom + 22} textAnchor="middle" fill="#111827" fontSize="11" fontWeight="600">{formatTickDate(tick)}</text>
                    </g>
                  );
                })}

                <text x={chartArea.marginLeft - 42} y={chartArea.marginTop + 6} fill="#111827" fontSize="11" fontWeight="700" transform={`rotate(-90 ${chartArea.marginLeft - 42} ${chartArea.marginTop + 6})`}>Total</text>

                {view === 'total' ? (
                  <g>
                    <g>
                      <circle cx={chartArea.width / 2 - 26} cy={44} r="6" fill="#3559a8" />
                      <text x={chartArea.width / 2 - 10} y={48} fill="#111827" fontSize="12" fontWeight="700">Total</text>
                    </g>

                    <path d={toSmoothPath(totalSeries)} fill="none" stroke="#496cb8" strokeWidth="5" strokeOpacity="0.85" />
                    {totalSeries.map((point, index) => (
                      <g key={`total-${index}`}>
                        <circle cx={point.x} cy={point.y} r="4.8" fill="#3559a8" />
                        <text x={point.x} y={point.y - 10} textAnchor="middle" fill="#496cb8" fontSize="10" fontWeight="700">{point.value}</text>
                        <circle
                          cx={point.x}
                          cy={point.y}
                          r="12"
                          fill="transparent"
                          onMouseEnter={() => setHoverPoint({ x: point.x, y: point.y, date: point.date, label: 'Total', value: point.value })}
                          onMouseLeave={() => setHoverPoint(null)}
                        >
                          <title>{`${point.date} | Total: ${point.value}`}</title>
                        </circle>
                      </g>
                    ))}
                  </g>
                ) : (
                  <g>
                    <g>
                      <circle cx={chartArea.width / 2 - 86} cy={44} r="6" fill="#5d84d8" />
                      <text x={chartArea.width / 2 - 70} y={48} fill="#111827" fontSize="12" fontWeight="700">Pirkland</text>
                      <circle cx={chartArea.width / 2 + 16} cy={44} r="6" fill="#8f4de8" />
                      <text x={chartArea.width / 2 + 32} y={48} fill="#111827" fontSize="12" fontWeight="700">Melrose</text>
                    </g>

                    <path d={toSmoothPath(pirklandSeries)} fill="none" stroke="#5d84d8" strokeWidth="5" strokeOpacity="0.8" />
                    <path d={toSmoothPath(melroseSeries)} fill="none" stroke="#8f4de8" strokeWidth="5" strokeOpacity="0.8" />

                    {pirklandSeries.map((point, index) => (
                      <g key={`pirkland-${index}`}>
                        <circle cx={point.x} cy={point.y} r="4.3" fill="#5d84d8" />
                        <text x={point.x} y={point.y - 10} textAnchor="middle" fill="#5d84d8" fontSize="10" fontWeight="700">{point.value}</text>
                        <circle
                          cx={point.x}
                          cy={point.y}
                          r="12"
                          fill="transparent"
                          onMouseEnter={() => setHoverPoint({ x: point.x, y: point.y, date: point.date, label: 'Pirkland', value: point.value })}
                          onMouseLeave={() => setHoverPoint(null)}
                        >
                          <title>{`${point.date} | Pirkland: ${point.value}`}</title>
                        </circle>
                      </g>
                    ))}

                    {melroseSeries.map((point, index) => (
                      <g key={`melrose-${index}`}>
                        <circle cx={point.x} cy={point.y} r="4.3" fill="#8f4de8" />
                        <text x={point.x} y={point.y - 10} textAnchor="middle" fill="#8f4de8" fontSize="10" fontWeight="700">{point.value}</text>
                        <circle
                          cx={point.x}
                          cy={point.y}
                          r="12"
                          fill="transparent"
                          onMouseEnter={() => setHoverPoint({ x: point.x, y: point.y, date: point.date, label: 'Melrose', value: point.value })}
                          onMouseLeave={() => setHoverPoint(null)}
                        >
                          <title>{`${point.date} | Melrose: ${point.value}`}</title>
                        </circle>
                      </g>
                    ))}
                  </g>
                )}
              </svg>
            </div>

            <div className="mt-4 rounded border border-slateBlue/60 bg-[#0d121b]">
              <div className="border-b border-slateBlue/40 px-4 py-3 text-[10px] uppercase tracking-[0.3em] text-slate-400">
                Rally Data
              </div>
              <div className="max-h-80 overflow-y-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="sticky top-0 bg-[#141a24] text-slate-200">
                    <tr>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {totalTableRows.map((row) => (
                      <tr key={row.date} className="border-t border-slateBlue/30">
                        <td className="px-4 py-3 text-slate-300">{row.date}</td>
                        <td className="px-4 py-3 text-right font-mono text-silver">{row.total}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>

      <div className="rounded border border-slateBlue/70 bg-[#141a24] p-4">
        <button
          type="button"
          onClick={() => void load()}
          className="w-full rounded border border-slateBlue/60 px-3 py-2 text-xs uppercase tracking-[0.3em] text-slate-200 hover:bg-slateBlue/20"
        >
          Reload battle logs
        </button>
      </div>
    </section>
  );
}