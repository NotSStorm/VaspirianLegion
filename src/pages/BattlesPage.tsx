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

type ParsedBattleLogInput = {
  participant_name: string;
  kills: number;
  deaths: number;
  assists: number;
  unit: string;
};

async function upsertPersonnelDirectory(entries: Array<{ participant_name: string; unit: string }>) {
  const uniqueByName = new Map<string, { roblox_username: string; unit: string; updated_at: string }>();
  const nowIso = new Date().toISOString();

  entries.forEach((entry) => {
    const username = String(entry.participant_name || '').trim();
    if (!username) {
      return;
    }

    const key = username.toLowerCase();
    if (!uniqueByName.has(key)) {
      uniqueByName.set(key, {
        roblox_username: username,
        unit: String(entry.unit || 'Unassigned') || 'Unassigned',
        updated_at: nowIso
      });
    }
  });

  if (uniqueByName.size === 0) {
    return;
  }

  const { error } = await supabase
    .from('personnel')
    .upsert(Array.from(uniqueByName.values()), { onConflict: 'roblox_username' });

  if (error && !/does not exist|relation/i.test(error.message)) {
    throw error;
  }
}

export default function BattlesPage() {
  const [battles, setBattles] = useState<Battle[]>([]);
  const [logs, setLogs] = useState<BattleStatLog[]>([]);
  const [unitByName, setUnitByName] = useState<Record<string, string>>({});
  const [isStaff, setIsStaff] = useState(false);
  const [selectedBattleId, setSelectedBattleId] = useState<string>('');
  const [expandedBattleId, setExpandedBattleId] = useState<string>('');
  const [logText, setLogText] = useState('');
  const [battleLogText, setBattleLogText] = useState('');
  const [pendingBattleDeleteId, setPendingBattleDeleteId] = useState<string | null>(null);
  const [pendingLogDeleteId, setPendingLogDeleteId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formState, setFormState] = useState({
    id: '',
    name: '',
    classification: 'EU',
    commandingOfficer: '',
    date: '',
    pointsScored: 0,
    description: ''
  });

  const defaultFormState = {
    id: '',
    name: '',
    classification: 'EU',
    commandingOfficer: '',
    date: '',
    pointsScored: 0,
    description: ''
  };

  const loadBattles = async () => {
    setError(null);
    try {
      const { profile, session } = await getAuthenticatedState();
      setIsStaff(profile?.role === 'admin' || profile?.role === 'officer');

      const [{ data: battleData, error: battleError }, { data: logData, error: logError }, { data: rosterData, error: rosterError }] = await Promise.all([
        supabase.from('battles').select('*').order('start_date', { ascending: false }),
        supabase.from('battle_stat_logs').select('id, battle_id, participant_name, unit, kills, deaths, assists').order('created_at', { ascending: false }),
        supabase.from('roster').select('callsign, company, profile:profiles!roster_profile_id_fkey(roblox_username, discord_username)')
      ]);

      if (battleError) throw battleError;
      if (logError) throw logError;
      if (rosterError) throw rosterError;

      const normalizeName = (value: string) => value.replace(/[_\s]+/g, '').toLowerCase();
      const nameMap: Record<string, string> = {};
      (rosterData || []).forEach((entry: any) => {
        const unit = String(entry.company || 'Unassigned');
        const aliases = [entry?.profile?.roblox_username, entry?.profile?.discord_username, entry?.callsign]
          .map((alias) => String(alias || '').trim())
          .filter(Boolean);
        aliases.forEach((alias) => {
          nameMap[normalizeName(alias)] = unit;
        });
      });
      setUnitByName(nameMap);

      setBattles((battleData || []) as Battle[]);
      setLogs((logData || []) as BattleStatLog[]);
      setExpandedBattleId('');
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

  const logsByBattle = useMemo(() => {
    const grouped = new Map<string, BattleStatLog[]>();
    logs.forEach((entry) => {
      const existing = grouped.get(entry.battle_id) || [];
      grouped.set(entry.battle_id, [...existing, entry]);
    });
    return grouped;
  }, [logs]);

  const personnelCountByBattle = useMemo(() => {
    const counts = new Map<string, number>();
    logsByBattle.forEach((entries, battleId) => {
      const uniqueNames = new Set(
        entries
          .map((entry) => String(entry.participant_name || '').trim().toLowerCase())
          .filter(Boolean)
      );
      counts.set(battleId, uniqueNames.size);
    });
    return counts;
  }, [logsByBattle]);

  const selectedLogs = useMemo(() => logs.filter((entry) => entry.battle_id === selectedBattleId), [logs, selectedBattleId]);
  const selectedBattle = useMemo(() => battles.find((battle) => battle.id === selectedBattleId) || null, [battles, selectedBattleId]);

  const inferUnit = (participantName: string) => {
    const normalized = participantName.replace(/[_\s]+/g, '').toLowerCase();
    return unitByName[normalized] || 'Unassigned';
  };

  const parseBattleLogLine = (line: string): ParsedBattleLogInput | null => {
    const trimmed = line.trim();
    if (!trimmed) {
      return null;
    }

    const rawParts = trimmed.includes('\t')
      ? trimmed.split('\t')
      : trimmed.split(',');
    const parts = rawParts.map((part) => part.trim()).filter((part, index) => part || index === 0);
    const participantName = parts[0] || '';

    if (!participantName) {
      return null;
    }

    return {
      participant_name: participantName,
      kills: Number(parts[1]) || 0,
      deaths: Number(parts[2]) || 0,
      assists: Number(parts[3]) || 0,
      unit: inferUnit(participantName)
    };
  };

  const parseBattleLogText = (text: string) => text
    .split(/\r?\n/)
    .map((line) => parseBattleLogLine(line))
    .filter((entry): entry is ParsedBattleLogInput => Boolean(entry));

  const insertBattleLogs = async (battleId: string, entries: ParsedBattleLogInput[]) => {
    if (entries.length === 0) {
      return;
    }

    const { data: { session } } = await supabase.auth.getSession();
    const payload = entries.map((entry) => ({
      battle_id: battleId,
      participant_name: entry.participant_name,
      unit: entry.unit,
      kills: entry.kills,
      deaths: entry.deaths,
      assists: entry.assists,
      created_by: session?.user?.id || null,
      updated_at: new Date().toISOString()
    }));

    const { error: insertError } = await supabase.from('battle_stat_logs').insert(payload);
    if (insertError) throw insertError;

    await upsertPersonnelDirectory(entries.map((entry) => ({
      participant_name: entry.participant_name,
      unit: entry.unit
    })));
  };

  const syncBattleDerivedFields = async (battleId: string) => {
    const { data, error: queryError } = await supabase
      .from('battle_stat_logs')
      .select('participant_name')
      .eq('battle_id', battleId);

    if (queryError) throw queryError;

    const uniqueNames = new Set(
      ((data || []) as Array<{ participant_name: string }>)
        .map((entry) => String(entry.participant_name || '').trim().toLowerCase())
        .filter(Boolean)
    );

    const { error: updateError } = await supabase
      .from('battles')
      .update({ personnel_count: uniqueNames.size })
      .eq('id', battleId);

    if (updateError) throw updateError;
  };

  const saveBattle = async () => {
    setError(null);
    try {
      const parsedDate = new Date(formState.date);
      const draftBattleLogs = !formState.id
        ? parseBattleLogText(battleLogText).filter((entry) => !(entry.participant_name.toLowerCase() === 'name' && entry.kills === 0 && entry.deaths === 0 && entry.assists === 0))
        : [];
      const payload = {
        name: formState.name,
        classification: formState.classification,
        status: !Number.isNaN(parsedDate.getTime()) && parsedDate > new Date() ? 'Scheduled' : 'Completed',
        theater: 'N/A',
        commanding_officer: formState.commandingOfficer,
        personnel_count: formState.id
          ? (personnelCountByBattle.get(formState.id) || 0)
          : draftBattleLogs.length > 0
            ? new Set(draftBattleLogs.map((entry) => entry.participant_name.trim().toLowerCase())).size
          : 0,
        start_date: formState.date,
        threat_level: Number(formState.pointsScored) || 0,
        description: formState.description || 'Operational record pending update.'
      };

      if (formState.id) {
        const { error: updateError } = await supabase.from('battles').update(payload).eq('id', formState.id);
        if (updateError) throw updateError;
      } else {
        const { data: insertedBattle, error: insertError } = await supabase
          .from('battles')
          .insert(payload)
          .select('id')
          .single();
        if (insertError) throw insertError;

        if (insertedBattle?.id && draftBattleLogs.length > 0) {
          await insertBattleLogs(insertedBattle.id, draftBattleLogs);
          await syncBattleDerivedFields(insertedBattle.id);
        }
      }

      setFormState(defaultFormState);
      setBattleLogText('');
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

      await upsertPersonnelDirectory([{ participant_name: payload.participant_name, unit: payload.unit }]);

      await syncBattleDerivedFields(selectedBattleId);

      await loadBattles();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save battle stat log.');
    }
  };

  const deleteLog = async (id: string) => {
    setError(null);
    try {
      const battleId = logs.find((entry) => entry.id === id)?.battle_id || null;
      const { error: deleteError } = await supabase.from('battle_stat_logs').delete().eq('id', id);
      if (deleteError) throw deleteError;

      if (battleId) {
        await syncBattleDerivedFields(battleId);
      }

      await loadBattles();
    } catch (deleteErr) {
      setError(deleteErr instanceof Error ? deleteErr.message : 'Unable to delete battle log.');
    }
  };

  const deleteBattle = async (id: string) => {
    setError(null);
    try {
      const { error: deleteError } = await supabase.from('battles').delete().eq('id', id);
      if (deleteError) throw deleteError;

      if (selectedBattleId === id) {
        setSelectedBattleId('');
      }
      if (expandedBattleId === id) {
        setExpandedBattleId('');
      }

      if (formState.id === id) {
        setFormState(defaultFormState);
      }

      await loadBattles();
    } catch (deleteErr) {
      setError(deleteErr instanceof Error ? deleteErr.message : 'Unable to delete battle.');
    }
  };

  const importLogs = async () => {
    if (!selectedBattleId || !logText.trim()) {
      return;
    }

    const lines = parseBattleLogText(logText)
      .filter((entry) => entry.participant_name && !(entry.participant_name.toLowerCase() === 'name' && entry.kills === 0 && entry.deaths === 0 && entry.assists === 0));

    if (lines.length === 0) {
      return;
    }

    setError(null);

    try {
      await insertBattleLogs(selectedBattleId, lines);

      await syncBattleDerivedFields(selectedBattleId);

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
          <div key={battle.id} className={expandedBattleId === battle.id ? 'rounded border border-silver/40 p-1' : ''}>
            <BattleCard
              name={battle.name}
              classification={battle.classification}
              commandingOfficer={battle.commanding_officer}
              personnelCount={personnelCountByBattle.get(battle.id) ?? battle.personnel_count}
              date={battle.start_date}
              pointsScored={battle.threat_level}
            />
            <button
              type="button"
              onClick={() => setExpandedBattleId((current) => current === battle.id ? '' : battle.id)}
              className="mt-2 rounded border border-slateBlue/70 px-3 py-1 text-xs uppercase tracking-[0.3em] text-slate-300"
            >
              View Logs
            </button>
            {expandedBattleId === battle.id && (
              <div className="mt-3 rounded border border-slateBlue/60 bg-[#0d121b] p-4">
                <div className="mb-3 text-[10px] uppercase tracking-[0.3em] text-slate-400">Battle Log Sheet</div>
                {(logsByBattle.get(battle.id) || []).length === 0 ? (
                  <p className="text-sm text-slate-400">No logs recorded for this battle yet.</p>
                ) : (
                  <div className="overflow-auto rounded border border-slateBlue/50">
                    <table className="min-w-full text-left text-sm">
                      <thead className="bg-slateBlue/30 text-slate-200">
                        <tr>
                          <th className="px-3 py-2">Name</th>
                          <th className="px-3 py-2">K</th>
                          <th className="px-3 py-2">D</th>
                          <th className="px-3 py-2">A</th>
                          <th className="px-3 py-2">Unit</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(logsByBattle.get(battle.id) || []).map((entry) => (
                          <tr key={entry.id} className="border-t border-slateBlue/40">
                            <td className="px-3 py-2 font-semibold text-silver">{entry.participant_name}</td>
                            <td className="px-3 py-2 text-slate-300">{entry.kills}</td>
                            <td className="px-3 py-2 text-slate-300">{entry.deaths}</td>
                            <td className="px-3 py-2 text-slate-300">{entry.assists}</td>
                            <td className="px-3 py-2 text-slate-300">{entry.unit}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
            {isStaff && (
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setFormState({
                    id: battle.id,
                    name: battle.name,
                    classification: battle.classification,
                    commandingOfficer: battle.commanding_officer,
                    date: battle.start_date,
                    pointsScored: battle.threat_level,
                    description: battle.description
                  })}
                  className="rounded border border-slateBlue/70 px-3 py-1 text-xs uppercase tracking-[0.3em] text-slate-300"
                >
                  Edit Battle
                </button>
                <button
                  type="button"
                  onClick={() => setPendingBattleDeleteId(battle.id)}
                  className="rounded border border-red-500/60 px-3 py-1 text-xs uppercase tracking-[0.3em] text-red-300"
                >
                  Delete Battle
                </button>
              </div>
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
                  <select value={formState.classification} onChange={(event) => setFormState((prev) => ({ ...prev, classification: event.target.value }))} className="mt-1 w-full rounded border border-slateBlue/60 bg-[#0d121b] px-3 py-2 text-sm text-silver">
                    <option value="Early EU">Early EU</option>
                    <option value="EU">EU</option>
                    <option value="NA">NA</option>
                    <option value="Late NA">Late NA</option>
                  </select>
                </label>
                <label className="text-xs text-slate-400">Date
                  <input type="date" value={formState.date} onChange={(event) => setFormState((prev) => ({ ...prev, date: event.target.value }))} className="mt-1 w-full rounded border border-slateBlue/60 bg-[#0d121b] px-3 py-2 text-sm text-silver" />
                </label>
              </div>
              <label className="text-xs text-slate-400">Commanding Officer
                <input value={formState.commandingOfficer} onChange={(event) => setFormState((prev) => ({ ...prev, commandingOfficer: event.target.value }))} placeholder="Commanding officer" className="mt-1 w-full rounded border border-slateBlue/60 bg-[#0d121b] px-3 py-2 text-sm text-silver" />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="text-xs text-slate-400">Personnel
                  <input
                    type="number"
                    value={formState.id ? (personnelCountByBattle.get(formState.id) || 0) : 0}
                    readOnly
                    className="mt-1 w-full rounded border border-slateBlue/60 bg-[#0d121b] px-3 py-2 text-sm text-slate-400"
                  />
                </label>
                <label className="text-xs text-slate-400">Points Scored
                  <input type="number" min={0} value={formState.pointsScored} onChange={(event) => setFormState((prev) => ({ ...prev, pointsScored: Number(event.target.value) }))} placeholder="Points scored" className="mt-1 w-full rounded border border-slateBlue/60 bg-[#0d121b] px-3 py-2 text-sm text-silver" />
                </label>
              </div>
              {!formState.id ? (
                <label className="text-xs text-slate-400">Battle Logs
                  <textarea value={battleLogText} onChange={(event) => setBattleLogText(event.target.value)} placeholder="Name\tK\tD\tA\nName only is also accepted" className="mt-1 min-h-[120px] w-full rounded border border-slateBlue/60 bg-[#0d121b] px-3 py-2 text-sm text-silver" />
                </label>
              ) : (
                <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Use the log import panel to add or edit battle logs for an existing battle.</p>
              )}
              <button type="button" onClick={() => void saveBattle()} className="rounded border border-silver/50 bg-silver px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-slateBlue">{formState.id ? 'Update Battle' : 'Create Battle'}</button>
            </div>
          </div>

          <div className="rounded border border-slateBlue/70 bg-[#141a24] p-6">
            <h3 className="text-lg font-semibold uppercase tracking-[0.3em] text-silver">Battle Logs (Name / K / D / A)</h3>
            <p className="mt-1 text-sm text-slate-300">Selected battle: <span className="font-semibold text-silver">{selectedBattle?.name || 'None selected'}</span></p>
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
              <p className="text-xs text-slate-400">Units are auto-mapped from Personnel roster by name, and remain editable per row.</p>
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
                            <button type="button" onClick={() => setPendingLogDeleteId(entry.id)} className="rounded border border-red-500/60 px-2 py-1 text-[10px] uppercase tracking-[0.3em] text-red-300">Delete</button>
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

      {pendingBattleDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded border border-slateBlue/70 bg-[#141a24] p-6">
            <h4 className="text-lg font-semibold uppercase tracking-[0.2em] text-silver">Delete Battle</h4>
            <p className="mt-3 text-sm text-slate-300">This removes the battle and its linked logs. Continue?</p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingBattleDeleteId(null)}
                className="rounded border border-slateBlue/70 px-3 py-2 text-xs uppercase tracking-[0.3em] text-slate-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  const targetId = pendingBattleDeleteId;
                  setPendingBattleDeleteId(null);
                  if (targetId) {
                    await deleteBattle(targetId);
                  }
                }}
                className="rounded border border-red-500/60 bg-red-500/10 px-3 py-2 text-xs uppercase tracking-[0.3em] text-red-300"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingLogDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded border border-slateBlue/70 bg-[#141a24] p-6">
            <h4 className="text-lg font-semibold uppercase tracking-[0.2em] text-silver">Delete Log Entry</h4>
            <p className="mt-3 text-sm text-slate-300">This log entry will be permanently removed. Continue?</p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingLogDeleteId(null)}
                className="rounded border border-slateBlue/70 px-3 py-2 text-xs uppercase tracking-[0.3em] text-slate-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  const targetId = pendingLogDeleteId;
                  setPendingLogDeleteId(null);
                  if (targetId) {
                    await deleteLog(targetId);
                  }
                }}
                className="rounded border border-red-500/60 bg-red-500/10 px-3 py-2 text-xs uppercase tracking-[0.3em] text-red-300"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
