import { useEffect, useMemo, useState } from 'react';
import BattleCard from '../components/shared/BattleCard';
import { getAuthenticatedState } from '../lib/auth';
import { supabase } from '../lib/supabase';

type Battle = {
  id: string;
  name: string;
  classification: string;
  status: string;
  theater: string;
  commanding_officer: string;
  personnel_count: number;
  start_date: string;
  threat_level: number;
  description: string;
};

type BattleLog = {
  id: string;
  battle_id: string;
  log_entry: string;
  created_at: string;
};

export default function BattlesPage() {
  const [battles, setBattles] = useState<Battle[]>([]);
  const [logs, setLogs] = useState<BattleLog[]>([]);
  const [isStaff, setIsStaff] = useState(false);
  const [selectedBattleId, setSelectedBattleId] = useState<string>('');
  const [logText, setLogText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [formState, setFormState] = useState({
    id: '',
    name: '',
    classification: 'Public',
    status: 'Pending',
    theater: '',
    commandingOfficer: '',
    personnelCount: 0,
    date: '',
    threatLevel: 1,
    description: ''
  });

  const loadBattles = async () => {
    setError(null);
    try {
      const { profile, session } = await getAuthenticatedState();
      setIsStaff(profile?.role === 'admin' || profile?.role === 'officer');

      const [{ data: battleData, error: battleError }, { data: logData, error: logError }] = await Promise.all([
        supabase.from('battles').select('*').order('start_date', { ascending: false }),
        supabase.from('battle_logs').select('id, battle_id, log_entry, created_at').order('created_at', { ascending: false })
      ]);

      if (battleError) throw battleError;
      if (logError) throw logError;

      setBattles((battleData || []) as Battle[]);
      setLogs((logData || []) as BattleLog[]);
      if (!selectedBattleId && battleData && battleData.length > 0) {
        setSelectedBattleId((battleData[0] as any).id);
      }

      if (!session?.user) {
        setIsStaff(false);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load battles.');
      setBattles([]);
      setLogs([]);
    }
  };

  useEffect(() => {
    void loadBattles();
  }, []);

  const selectedLogs = useMemo(
    () => logs.filter((entry) => entry.battle_id === selectedBattleId),
    [logs, selectedBattleId]
  );

  const saveBattle = async () => {
    setError(null);
    try {
      const payload = {
        name: formState.name,
        classification: formState.classification,
        status: formState.status,
        theater: formState.theater,
        commanding_officer: formState.commandingOfficer,
        personnel_count: Number(formState.personnelCount) || 0,
        start_date: formState.date,
        threat_level: Math.max(1, Math.min(5, Number(formState.threatLevel) || 1)),
        description: formState.description || 'Operational record pending update.'
      };

      if (formState.id) {
        const { error: updateError } = await supabase.from('battles').update(payload).eq('id', formState.id);
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase.from('battles').insert(payload);
        if (insertError) throw insertError;
      }

      setFormState({
        id: '',
        name: '',
        classification: 'Public',
        status: 'Pending',
        theater: '',
        commandingOfficer: '',
        personnelCount: 0,
        date: '',
        threatLevel: 1,
        description: ''
      });
      await loadBattles();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save battle.');
    }
  };

  const submitLog = async () => {
    if (!selectedBattleId || !logText.trim()) return;
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { error: insertError } = await supabase.from('battle_logs').insert({
        battle_id: selectedBattleId,
        log_entry: logText.trim(),
        created_by: session?.user?.id || null
      });
      if (insertError) throw insertError;
      setLogText('');
      await loadBattles();
    } catch (logError) {
      setError(logError instanceof Error ? logError.message : 'Unable to save battle log.');
    }
  };

  return (
    <section className="space-y-6">
      <div className="rounded border border-slateBlue/70 bg-[#141a24] p-6">
        <div className="text-[10px] uppercase tracking-[0.35em] text-slate-400">Battles Ledger</div>
        <h2 className="mt-2 text-3xl font-semibold uppercase tracking-[0.2em] text-silver">Engagements</h2>
        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {battles.map((battle) => (
          <div key={battle.id}>
            <BattleCard
              name={battle.name}
              classification={battle.classification}
              status={battle.status}
              theater={battle.theater}
              commandingOfficer={battle.commanding_officer}
              personnelCount={battle.personnel_count}
              date={battle.start_date}
              threatLevel={battle.threat_level}
            />
            {isStaff && (
              <button
                type="button"
                onClick={() => setFormState({
                  id: battle.id,
                  name: battle.name,
                  classification: battle.classification,
                  status: battle.status,
                  theater: battle.theater,
                  commandingOfficer: battle.commanding_officer,
                  personnelCount: battle.personnel_count,
                  date: battle.start_date,
                  threatLevel: battle.threat_level,
                  description: battle.description
                })}
                className="mt-2 rounded border border-slateBlue/70 px-3 py-1 text-xs uppercase tracking-[0.3em] text-slate-300"
              >
                Edit Battle
              </button>
            )}
          </div>
        ))}
      </div>

      {isStaff && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded border border-slateBlue/70 bg-[#141a24] p-6">
            <h3 className="text-lg font-semibold uppercase tracking-[0.3em] text-silver">Battle Editor</h3>
            <div className="mt-4 grid gap-3">
              <input value={formState.name} onChange={(event) => setFormState((prev) => ({ ...prev, name: event.target.value }))} placeholder="Battle name" className="rounded border border-slateBlue/60 bg-[#0d121b] px-3 py-2 text-sm text-silver" />
              <div className="grid grid-cols-2 gap-3">
                <input value={formState.classification} onChange={(event) => setFormState((prev) => ({ ...prev, classification: event.target.value }))} placeholder="Classification" className="rounded border border-slateBlue/60 bg-[#0d121b] px-3 py-2 text-sm text-silver" />
                <input value={formState.status} onChange={(event) => setFormState((prev) => ({ ...prev, status: event.target.value }))} placeholder="Status" className="rounded border border-slateBlue/60 bg-[#0d121b] px-3 py-2 text-sm text-silver" />
              </div>
              <input value={formState.theater} onChange={(event) => setFormState((prev) => ({ ...prev, theater: event.target.value }))} placeholder="Theater" className="rounded border border-slateBlue/60 bg-[#0d121b] px-3 py-2 text-sm text-silver" />
              <input value={formState.commandingOfficer} onChange={(event) => setFormState((prev) => ({ ...prev, commandingOfficer: event.target.value }))} placeholder="Commanding officer" className="rounded border border-slateBlue/60 bg-[#0d121b] px-3 py-2 text-sm text-silver" />
              <div className="grid grid-cols-3 gap-3">
                <input type="number" value={formState.personnelCount} onChange={(event) => setFormState((prev) => ({ ...prev, personnelCount: Number(event.target.value) }))} placeholder="Personnel" className="rounded border border-slateBlue/60 bg-[#0d121b] px-3 py-2 text-sm text-silver" />
                <input value={formState.date} onChange={(event) => setFormState((prev) => ({ ...prev, date: event.target.value }))} placeholder="Date" className="rounded border border-slateBlue/60 bg-[#0d121b] px-3 py-2 text-sm text-silver" />
                <input type="number" min={1} max={5} value={formState.threatLevel} onChange={(event) => setFormState((prev) => ({ ...prev, threatLevel: Number(event.target.value) }))} placeholder="Threat" className="rounded border border-slateBlue/60 bg-[#0d121b] px-3 py-2 text-sm text-silver" />
              </div>
              <textarea value={formState.description} onChange={(event) => setFormState((prev) => ({ ...prev, description: event.target.value }))} placeholder="Battle description / notes" className="min-h-[90px] rounded border border-slateBlue/60 bg-[#0d121b] px-3 py-2 text-sm text-silver" />
              <button type="button" onClick={() => void saveBattle()} className="rounded border border-silver/50 bg-silver px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-slateBlue">{formState.id ? 'Update Battle' : 'Create Battle'}</button>
            </div>
          </div>

          <div className="rounded border border-slateBlue/70 bg-[#141a24] p-6">
            <h3 className="text-lg font-semibold uppercase tracking-[0.3em] text-silver">Battle Logs</h3>
            <div className="mt-4 grid gap-3">
              <select value={selectedBattleId} onChange={(event) => setSelectedBattleId(event.target.value)} className="rounded border border-slateBlue/60 bg-[#0d121b] px-3 py-2 text-sm text-silver">
                <option value="">Select battle</option>
                {battles.map((battle) => <option key={battle.id} value={battle.id}>{battle.name}</option>)}
              </select>
              <textarea value={logText} onChange={(event) => setLogText(event.target.value)} placeholder="Add battle log entry" className="min-h-[90px] rounded border border-slateBlue/60 bg-[#0d121b] px-3 py-2 text-sm text-silver" />
              <button type="button" onClick={() => void submitLog()} className="rounded border border-slateBlue/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-silver">Save Log</button>
              <div className="max-h-56 space-y-2 overflow-auto">
                {selectedLogs.map((entry) => (
                  <div key={entry.id} className="rounded border border-slateBlue/50 p-2 text-sm text-slate-300">
                    <div>{entry.log_entry}</div>
                    <div className="mt-1 text-xs text-slate-400">{new Date(entry.created_at).toLocaleString()}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
