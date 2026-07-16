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

type BattleStatLog = {
  id: string;
  battle_id: string;
  participant_name: string;
  unit: string;
  kills: number;
  deaths: number;
  assists: number;
};

export default function BattlesPage() {
  const [battles, setBattles] = useState<Battle[]>([]);
  const [logs, setLogs] = useState<BattleStatLog[]>([]);
  const [isStaff, setIsStaff] = useState(false);
  const [selectedBattleId, setSelectedBattleId] = useState<string>('');
  const [logText, setLogText] = useState('');
  const [importUnit, setImportUnit] = useState('87th Melrose');
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
        supabase.from('battle_stat_logs').select('id, battle_id, participant_name, unit, kills, deaths, assists').order('created_at', { ascending: false })
      ]);

      if (battleError) throw battleError;
      if (logError) throw logError;

      setBattles((battleData || []) as Battle[]);
      setLogs((logData || []) as BattleStatLog[]);
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

  const selectedLogs = useMemo(() => logs.filter((entry) => entry.battle_id === selectedBattleId), [logs, selectedBattleId]);

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

  const upsertLog = async (entry: Partial<BattleStatLog>) => {
    if (!selectedBattleId || !entry.participant_name) {
      return;
    }

    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const payload = {
        battle_id: selectedBattleId,
        participant_name: entry.participant_name,
        unit: entry.unit || 'Unassigned',
        kills: Number(entry.kills) || 0,
        deaths: Number(entry.deaths) || 0,
        assists: Number(entry.assists) || 0,
        created_by: session?.user?.id || null,
        updated_at: new Date().toISOString()
      };

      const { error: insertError } = entry.id
        ? await supabase.from('battle_stat_logs').update(payload).eq('id', entry.id)
        : await supabase.from('battle_stat_logs').insert(payload);

      if (insertError) throw insertError;

      await loadBattles();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save battle stat log.');
    }
  };

  const deleteLog = async (id: string) => {
    setError(null);
    try {
      const { error: deleteError } = await supabase.from('battle_stat_logs').delete().eq('id', id);
      if (deleteError) throw deleteError;
      await loadBattles();
    } catch (deleteErr) {
      setError(deleteErr instanceof Error ? deleteErr.message : 'Unable to delete battle log.');
    }
  };

  const importLogs = async () => {
    if (!selectedBattleId || !logText.trim()) {
      return;
    }

    const lines = logText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .filter((line) => !/^name\s+k\s+d\s+a$/i.test(line.replace(/\t+/g, ' ')));

    if (lines.length === 0) {
      return;
    }

    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const payload = lines
        .map((line) => {
          const parts = line.includes('\t')
            ? line.split('\t')
            : line.split(',').map((value) => value.trim());

          if (parts.length < 4) {
            return null;
          }

          const [participantName, kills, deaths, assists] = parts;
          return {
            battle_id: selectedBattleId,
            participant_name: String(participantName).trim(),
            unit: importUnit,
            kills: Number(kills) || 0,
            deaths: Number(deaths) || 0,
            assists: Number(assists) || 0,
            created_by: session?.user?.id || null,
            updated_at: new Date().toISOString()
          };
        })
        .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

      if (payload.length === 0) {
        return;
      }

      const { error: insertError } = await supabase.from('battle_stat_logs').insert(payload);
      if (insertError) throw insertError;

      setLogText('');
      await loadBattles();
    } catch (importErr) {
      setError(importErr instanceof Error ? importErr.message : 'Unable to import battle logs.');
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
              <label className="text-xs text-slate-400">Battle Name
                <input value={formState.name} onChange={(event) => setFormState((prev) => ({ ...prev, name: event.target.value }))} placeholder="Battle name" className="mt-1 w-full rounded border border-slateBlue/60 bg-[#0d121b] px-3 py-2 text-sm text-silver" />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="text-xs text-slate-400">Classification
                  <input value={formState.classification} onChange={(event) => setFormState((prev) => ({ ...prev, classification: event.target.value }))} placeholder="Classification" className="mt-1 w-full rounded border border-slateBlue/60 bg-[#0d121b] px-3 py-2 text-sm text-silver" />
                </label>
                <label className="text-xs text-slate-400">Status
                  <input value={formState.status} onChange={(event) => setFormState((prev) => ({ ...prev, status: event.target.value }))} placeholder="Status" className="mt-1 w-full rounded border border-slateBlue/60 bg-[#0d121b] px-3 py-2 text-sm text-silver" />
                </label>
              </div>
              <label className="text-xs text-slate-400">Theater
                <input value={formState.theater} onChange={(event) => setFormState((prev) => ({ ...prev, theater: event.target.value }))} placeholder="Theater" className="mt-1 w-full rounded border border-slateBlue/60 bg-[#0d121b] px-3 py-2 text-sm text-silver" />
              </label>
              <label className="text-xs text-slate-400">Commanding Officer
                <input value={formState.commandingOfficer} onChange={(event) => setFormState((prev) => ({ ...prev, commandingOfficer: event.target.value }))} placeholder="Commanding officer" className="mt-1 w-full rounded border border-slateBlue/60 bg-[#0d121b] px-3 py-2 text-sm text-silver" />
              </label>
              <div className="grid grid-cols-3 gap-3">
                <label className="text-xs text-slate-400">Personnel
                  <input type="number" value={formState.personnelCount} onChange={(event) => setFormState((prev) => ({ ...prev, personnelCount: Number(event.target.value) }))} placeholder="Personnel" className="mt-1 w-full rounded border border-slateBlue/60 bg-[#0d121b] px-3 py-2 text-sm text-silver" />
                </label>
                <label className="text-xs text-slate-400">Date
                  <input value={formState.date} onChange={(event) => setFormState((prev) => ({ ...prev, date: event.target.value }))} placeholder="Date" className="mt-1 w-full rounded border border-slateBlue/60 bg-[#0d121b] px-3 py-2 text-sm text-silver" />
                </label>
                <label className="text-xs text-slate-400">Performance (1-5)
                  <input type="number" min={1} max={5} value={formState.threatLevel} onChange={(event) => setFormState((prev) => ({ ...prev, threatLevel: Number(event.target.value) }))} placeholder="Performance" className="mt-1 w-full rounded border border-slateBlue/60 bg-[#0d121b] px-3 py-2 text-sm text-silver" />
                </label>
              </div>
              <label className="text-xs text-slate-400">Battle Notes
                <textarea value={formState.description} onChange={(event) => setFormState((prev) => ({ ...prev, description: event.target.value }))} placeholder="Battle description / notes" className="mt-1 min-h-[90px] w-full rounded border border-slateBlue/60 bg-[#0d121b] px-3 py-2 text-sm text-silver" />
              </label>
              <button type="button" onClick={() => void saveBattle()} className="rounded border border-silver/50 bg-silver px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-slateBlue">{formState.id ? 'Update Battle' : 'Create Battle'}</button>
            </div>
          </div>

          <div className="rounded border border-slateBlue/70 bg-[#141a24] p-6">
            <h3 className="text-lg font-semibold uppercase tracking-[0.3em] text-silver">Battle Logs (Name / K / D / A)</h3>
            <div className="mt-4 grid gap-3">
              <label className="text-xs text-slate-400">Battle
                <select value={selectedBattleId} onChange={(event) => setSelectedBattleId(event.target.value)} className="mt-1 w-full rounded border border-slateBlue/60 bg-[#0d121b] px-3 py-2 text-sm text-silver">
                  <option value="">Select battle</option>
                  {battles.map((battle) => <option key={battle.id} value={battle.id}>{battle.name}</option>)}
                </select>
              </label>

              <label className="text-xs text-slate-400">Paste Tab/CSV Logs (Name\tK\tD\tA)
                <textarea value={logText} onChange={(event) => setLogText(event.target.value)} placeholder="Name\tK\tD\tA" className="mt-1 min-h-[90px] w-full rounded border border-slateBlue/60 bg-[#0d121b] px-3 py-2 text-sm text-silver" />
              </label>
              <label className="text-xs text-slate-400">Unit For Imported Rows
                <select value={importUnit} onChange={(event) => setImportUnit(event.target.value)} className="mt-1 w-full rounded border border-slateBlue/60 bg-[#0d121b] px-3 py-2 text-sm text-silver">
                  <option value="87th Melrose">87th Melrose</option>
                  <option value="82nd Pirkland">82nd Pirkland</option>
                  <option value="Battery Command">Battery Command</option>
                </select>
              </label>
              <button type="button" onClick={() => void importLogs()} className="rounded border border-slateBlue/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-silver">Import Logs</button>

              <div className="overflow-auto rounded border border-slateBlue/60">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slateBlue/30 text-slate-200">
                    <tr>
                      <th className="px-3 py-2">Name</th>
                      <th className="px-3 py-2">K</th>
                      <th className="px-3 py-2">D</th>
                      <th className="px-3 py-2">A</th>
                      <th className="px-3 py-2">Unit</th>
                      <th className="px-3 py-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedLogs.map((entry) => (
                      <tr key={entry.id} className="border-t border-slateBlue/40">
                        <td className="px-3 py-2">
                          <input value={entry.participant_name} onChange={(event) => setLogs((prev) => prev.map((row) => row.id === entry.id ? { ...row, participant_name: event.target.value } : row))} className="w-full rounded border border-slateBlue/60 bg-[#0d121b] px-2 py-1 text-sm text-silver" />
                        </td>
                        <td className="px-3 py-2"><input type="number" value={entry.kills} onChange={(event) => setLogs((prev) => prev.map((row) => row.id === entry.id ? { ...row, kills: Number(event.target.value) } : row))} className="w-16 rounded border border-slateBlue/60 bg-[#0d121b] px-2 py-1 text-sm text-silver" /></td>
                        <td className="px-3 py-2"><input type="number" value={entry.deaths} onChange={(event) => setLogs((prev) => prev.map((row) => row.id === entry.id ? { ...row, deaths: Number(event.target.value) } : row))} className="w-16 rounded border border-slateBlue/60 bg-[#0d121b] px-2 py-1 text-sm text-silver" /></td>
                        <td className="px-3 py-2"><input type="number" value={entry.assists} onChange={(event) => setLogs((prev) => prev.map((row) => row.id === entry.id ? { ...row, assists: Number(event.target.value) } : row))} className="w-16 rounded border border-slateBlue/60 bg-[#0d121b] px-2 py-1 text-sm text-silver" /></td>
                        <td className="px-3 py-2">
                          <select value={entry.unit} onChange={(event) => setLogs((prev) => prev.map((row) => row.id === entry.id ? { ...row, unit: event.target.value } : row))} className="rounded border border-slateBlue/60 bg-[#0d121b] px-2 py-1 text-sm text-silver">
                            <option value="87th Melrose">87th Melrose</option>
                            <option value="82nd Pirkland">82nd Pirkland</option>
                            <option value="Battery Command">Battery Command</option>
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex gap-2">
                            <button type="button" onClick={() => void upsertLog(entry)} className="rounded border border-slateBlue/70 px-2 py-1 text-[10px] uppercase tracking-[0.3em] text-slate-300">Save</button>
                            <button type="button" onClick={() => void deleteLog(entry.id)} className="rounded border border-red-500/60 px-2 py-1 text-[10px] uppercase tracking-[0.3em] text-red-300">Delete</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
