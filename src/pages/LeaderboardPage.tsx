import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';

type PerformanceLog = {
  id: string;
  profile_id: string;
  logged_on: string;
  period: 'weekly' | 'monthly' | string;
  total: number;
  kills: number;
  deaths: number;
  assists: number;
  company?: string | null;
  profile?: {
    roblox_username?: string | null;
    discord_username?: string | null;
  } | null;
};

export default function LeaderboardPage() {
  const [logs, setLogs] = useState<PerformanceLog[]>([]);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('performance_logs')
        .select('id, profile_id, logged_on, period, total, kills, deaths, assists, company, profile:profiles!performance_logs_profile_id_fkey(roblox_username, discord_username)')
        .order('logged_on', { ascending: false });
      setLogs((data || []) as PerformanceLog[]);
    };
    void load();
  }, []);

  const weekly = useMemo(() => logs.filter((log) => log.period === 'weekly').sort((a, b) => b.total - a.total), [logs]);
  const monthly = useMemo(() => logs.filter((log) => log.period === 'monthly').sort((a, b) => b.total - a.total), [logs]);

  const renderBoard = (title: string, board: PerformanceLog[]) => (
    <div className="rounded border border-slateBlue/70 bg-[#141a24] p-6">
      <h3 className="text-lg font-semibold uppercase tracking-[0.3em] text-silver">{title}</h3>
      <div className="mt-4 space-y-2">
        {board.length === 0 ? (
          <p className="text-sm text-slate-400">No data logged yet.</p>
        ) : board.map((entry, index) => (
          <div key={entry.id} className="flex items-center justify-between rounded border border-slateBlue/60 px-3 py-2 text-sm">
            <div className="text-slate-300">{index + 1}. {entry.profile?.roblox_username || entry.profile?.discord_username || entry.profile_id}</div>
            <div className="text-silver">Total {entry.total} | K {entry.kills} D {entry.deaths} A {entry.assists}</div>
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
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {renderBoard('Weekly Leaders', weekly)}
        {renderBoard('Monthly Leaders', monthly)}
      </div>
    </section>
  );
}